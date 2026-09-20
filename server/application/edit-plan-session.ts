import type { IsoDate } from '../domain/plan/calendar'
import type { EditImpact, SessionDraft } from '../domain/plan/manual-edit'
import {
  EditKind,
  draftIsKey,
  draftPrescription,
  editImpact,
  editRefusal,
} from '../domain/plan/manual-edit'
import { SessionStatus, type PlannedSessionRecord } from '../domain/plan/session'
import type { PauseAllowances } from '../domain/pause/pause'
import type { RacePriority } from '../domain/races/race'
import type { Clock } from '../domain/shared/clock'
import type { Prescription } from '../domain/shared/prescription'
import type { Sport } from '../domain/shared/sport'

export interface EditWeek {
  id: number
  startDate: IsoDate
  endDate: IsoDate
  targetRunM: number
}

export interface EditContext {
  week: EditWeek
  /** Volume visé la semaine précédente : la montée se mesure sur lui. */
  previousWeekRunM: number | null
  sessions: PlannedSessionRecord[]
  vdot: number
  maxWeeklyIncreasePct: number
  races: { date: IsoDate; priority: RacePriority }[]
  allowances?: PauseAllowances
}

export interface PlanEditGateway {
  /** Contexte de la journée visée, ou rien quand aucune semaine ne la couvre. */
  loadContext(date: IsoDate): Promise<EditContext | undefined>
  loadSession(sessionId: number): Promise<(PlannedSessionRecord & { weekId: number }) | undefined>
  writeSession(input: {
    sessionId: number
    sport: Sport
    prescription: Prescription
    key: boolean
  }): Promise<void>
  cancelSession(sessionId: number): Promise<void>
  createSession(input: {
    weekId: number
    date: IsoDate
    sport: Sport
    prescription: Prescription
    key: boolean
  }): Promise<number>
  /** Rend la journée au générateur : les séances manuelles du jour disparaissent. */
  clearDay(date: IsoDate): Promise<number>
}

export type EditOutcome = { ok: true; impact: EditImpact } | { ok: false; refusal: string }

/** Une séance annulée ne pèse plus rien : elle sort du volume de la semaine. */
function withoutSession(sessions: PlannedSessionRecord[], id: number): PlannedSessionRecord[] {
  return sessions.filter((item) => item.id !== id)
}

function posedRecord(
  draft: SessionDraft,
  context: EditContext,
  date: IsoDate,
  id: number,
): PlannedSessionRecord {
  const prescription = draftPrescription(draft, {
    vdot: context.vdot,
    targetRunM: context.week.targetRunM,
  })

  return {
    id,
    date,
    sport: draft.sport,
    code: prescription.code,
    status: SessionStatus.Modified,
    key: draftIsKey(draft),
    prescription,
  }
}

function impactOf(
  context: EditContext,
  date: IsoDate,
  before: PlannedSessionRecord[],
  after: PlannedSessionRecord[],
  posed?: PlannedSessionRecord,
): EditImpact {
  return editImpact({
    date,
    before,
    after,
    targetRunM: context.week.targetRunM,
    previousWeekRunM: context.previousWeekRunM,
    maxWeeklyIncreasePct: context.maxWeeklyIncreasePct,
    races: context.races,
    allowances: context.allowances,
    posed,
  })
}

/**
 * Ce que l'édition coûterait, sans rien écrire. C'est ce que l'écran montre
 * sous les champs avant que Ronan valide (§ 9, P6.43).
 */
export async function previewEdit(
  gateway: PlanEditGateway,
  clock: Clock,
  input: { kind: EditKind; date: IsoDate; sessionId?: number; draft?: SessionDraft },
): Promise<EditOutcome | undefined> {
  const context = await gateway.loadContext(input.date)
  const session = input.sessionId ? await gateway.loadSession(input.sessionId) : undefined
  if (input.sessionId && !session) return undefined

  const refusal = editRefusal({
    kind: input.kind,
    date: input.date,
    today: clock.today(),
    session,
    withinPlan: context !== undefined,
  })
  if (refusal || !context)
    return { ok: false, refusal: refusal ?? 'Cette date est hors du plan actif.' }

  const before = context.sessions

  if (input.kind === EditKind.Cancel && session) {
    return {
      ok: true,
      impact: impactOf(context, input.date, before, withoutSession(before, session.id)),
    }
  }

  if (!input.draft) return { ok: false, refusal: 'Il manque le sport et le type de la séance.' }

  const id = session?.id ?? 0
  const posed = posedRecord(input.draft, context, input.date, id)
  const after = [...withoutSession(before, id), posed]

  return { ok: true, impact: impactOf(context, input.date, before, after, posed) }
}

/**
 * Remplace une séance par celle que Ronan décrit. Sa journée est marquée à la
 * main : la régénération ne la retouchera plus (§ 5, P6.43).
 */
export async function replaceSession(
  gateway: PlanEditGateway,
  clock: Clock,
  sessionId: number,
  draft: SessionDraft,
): Promise<EditOutcome | undefined> {
  const session = await gateway.loadSession(sessionId)
  if (!session) return undefined

  const preview = await previewEdit(gateway, clock, {
    kind: EditKind.Replace,
    date: session.date,
    sessionId,
    draft,
  })
  if (!preview?.ok) return preview

  const context = (await gateway.loadContext(session.date))!
  const posed = posedRecord(draft, context, session.date, sessionId)

  await gateway.writeSession({
    sessionId,
    sport: draft.sport,
    prescription: posed.prescription,
    key: posed.key,
  })

  return preview
}

/** Retire une séance à venir sans la compter comme manquée (§ 5). */
export async function cancelSession(
  gateway: PlanEditGateway,
  clock: Clock,
  sessionId: number,
): Promise<EditOutcome | undefined> {
  const session = await gateway.loadSession(sessionId)
  if (!session) return undefined

  const preview = await previewEdit(gateway, clock, {
    kind: EditKind.Cancel,
    date: session.date,
    sessionId,
  })
  if (!preview?.ok) return preview

  await gateway.cancelSession(sessionId)
  return preview
}

export async function addSession(
  gateway: PlanEditGateway,
  clock: Clock,
  date: IsoDate,
  draft: SessionDraft,
): Promise<EditOutcome | undefined> {
  const preview = await previewEdit(gateway, clock, { kind: EditKind.Add, date, draft })
  if (!preview?.ok) return preview

  const context = (await gateway.loadContext(date))!
  const posed = posedRecord(draft, context, date, 0)

  await gateway.createSession({
    weekId: context.week.id,
    date,
    sport: draft.sport,
    prescription: posed.prescription,
    key: posed.key,
  })

  return preview
}

/** Rend une journée au générateur : elle repart du plan à la régénération. */
export async function restoreDay(
  gateway: PlanEditGateway,
  date: IsoDate,
): Promise<{ cleared: number }> {
  return { cleared: await gateway.clearDay(date) }
}
