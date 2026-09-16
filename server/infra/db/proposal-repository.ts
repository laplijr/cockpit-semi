import { and, asc, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { addDays } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { PauseType } from '../../domain/pause/pause'
import { applyToPrescription, isSessionEffect } from '../../domain/rules/apply'
import { toCyclingPrescription } from '../../domain/rules/convert'
import { ProposalStatus, type ProposalTrigger } from '../../domain/rules/proposal-status'
import {
  ProposalEffect,
  evaluateRules,
  type Proposal as DomainProposal,
  type RuleContext,
  type SessionOutcome,
  type UpcomingSession,
} from '../../domain/rules/rules'
import type { RunSessionCode, Prescription } from '../../domain/running/session-types'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { feedback, pause, proposal, session, week } from './schema'

/** Fenêtre de séances passées examinée par les règles. */
const LOOKBACK_DAYS = 10
/** Fenêtre de séances à venir que les règles peuvent ajuster. */
const LOOKAHEAD_DAYS = 10
/** Nombre de séances déjà jugées examinées par les règles. */
const RECENT_SESSIONS = 8

function repeatsOf(prescription: Prescription): number | null {
  const intense = prescription.steps.find((step) => step.intense && step.repeats)
  return intense?.repeats ?? null
}

async function buildContext(db: Database, today: string): Promise<RuleContext> {
  // Les séances déjà jugées font foi, même si elles sont datées après aujourd'hui :
  // c'est la dernière séance notée qui ancre la fenêtre, pas la date du jour.
  const rated = await db
    .select()
    .from(session)
    .leftJoin(feedback, eq(feedback.sessionId, session.id))
    .where(
      inArray(session.status, [SessionStatus.Done, SessionStatus.Modified, SessionStatus.Skipped]),
    )
    .orderBy(desc(session.date))
    .limit(RECENT_SESSIONS)

  const anchor = rated[0]?.session.date ?? today
  const horizon = anchor > today ? anchor : today

  const [past, future] = await Promise.all([
    Promise.resolve(rated.filter((row) => row.session.date >= addDays(horizon, -LOOKBACK_DAYS))),
    db
      .select()
      .from(session)
      .where(
        and(
          gte(session.date, addDays(horizon, 1)),
          lt(session.date, addDays(horizon, LOOKAHEAD_DAYS)),
          eq(session.status, SessionStatus.Planned),
        ),
      )
      .orderBy(asc(session.date)),
  ])

  const recent: SessionOutcome[] = past.map((row) => ({
    sessionId: row.session.id,
    date: row.session.date,
    sport: row.session.sport,
    code: row.session.code as RunSessionCode,
    key: row.session.key,
    expectedRpe: (row.session.prescription as unknown as Prescription).expectedRpe,
    rpe: row.feedback?.rpe ?? null,
    sensations: row.feedback?.sensations ?? [],
    sleepHours: row.feedback?.sleepHours ?? null,
    pain: row.feedback?.pain ?? null,
    // Faute de réalisé détaillé, on considère l'allure tenue si le RPE l'est.
    paceHeld:
      row.feedback === null ||
      row.feedback.rpe <= (row.session.prescription as unknown as Prescription).expectedRpe,
    skipped: row.session.status === SessionStatus.Skipped,
  }))

  const upcoming: UpcomingSession[] = future.map((row) => {
    const prescription = row.prescription as unknown as Prescription
    return {
      sessionId: row.id,
      date: row.date,
      sport: row.sport,
      code: row.code as RunSessionCode,
      key: row.key,
      distanceM: prescription.totalDistanceM,
      repeats: repeatsOf(prescription),
    }
  })

  return {
    today: horizon,
    recent,
    upcoming,
    sameDayStrength: upcoming.filter((item) => item.sport === Sport.Strength),
  }
}

/**
 * Évalue les règles et enregistre les propositions nouvelles. Une proposition
 * identique déjà en attente n'est pas dupliquée.
 */
export async function evaluateAndStore(
  db: Database,
  today: string,
  trigger: ProposalTrigger,
): Promise<DomainProposal[]> {
  const found = evaluateRules(await buildContext(db, today))
  if (found.length === 0) return []

  const pending = await db
    .select()
    .from(proposal)
    .where(eq(proposal.status, ProposalStatus.Proposed))

  const signature = (item: { ruleId: string; effect: string; targetId: number | null }) =>
    `${item.ruleId}|${item.effect}|${item.targetId ?? ''}`
  const known = new Set(pending.map(signature))

  const fresh = found.filter((item) => !known.has(signature({ ...item, targetId: item.target.id })))
  if (fresh.length === 0) return []

  await db.insert(proposal).values(
    fresh.map((item) => ({
      trigger,
      ruleId: item.ruleId,
      effect: item.effect,
      targetKind: item.target.kind,
      targetId: item.target.id,
      before: item.before,
      after: item.after,
      explanation: item.explanation,
    })),
  )

  return fresh
}

export async function listProposals(db: Database) {
  return db.select().from(proposal).orderBy(desc(proposal.createdAt), desc(proposal.id))
}

/** Accepte une proposition : l'effet est appliqué, puis la décision archivée. */
export async function acceptProposal(db: Database, id: number, today: string) {
  const [row] = await db.select().from(proposal).where(eq(proposal.id, id)).limit(1)
  if (!row) return undefined

  const effect = row.effect as ProposalEffect

  if (isSessionEffect(effect) && row.targetId !== null) {
    await updateSessionPrescription(db, row.targetId, (prescription) =>
      applyToPrescription(prescription, effect),
    )
  }

  if (effect === ProposalEffect.ConvertToCycling && row.targetId !== null) {
    await updateSessionPrescription(db, row.targetId, toCyclingPrescription, Sport.Cycling)
  }

  if (effect === ProposalEffect.FreezeProgression) await freezeProgression(db, today)
  if (effect === ProposalEffect.RestoreProgression) await restoreProgression(db, today)
  if (effect === ProposalEffect.ProposePause || effect === ProposalEffect.ForcePause) {
    await openPause(db, today, row.explanation)
  }

  await db
    .update(proposal)
    .set({ status: ProposalStatus.Accepted, decidedAt: new Date() })
    .where(eq(proposal.id, id))

  return row
}

async function updateSessionPrescription(
  db: Database,
  sessionId: number,
  transform: (prescription: Prescription) => Prescription,
  sport?: Sport,
) {
  const [target] = await db.select().from(session).where(eq(session.id, sessionId)).limit(1)
  if (!target) return

  const updated = transform(target.prescription as unknown as Prescription)
  await db
    .update(session)
    .set({
      prescription: updated as unknown as Record<string, unknown>,
      status: SessionStatus.Modified,
      ...(sport ? { sport } : {}),
    })
    .where(eq(session.id, sessionId))
}

/** Gèle la montée : la semaine suivante reprend le volume de la semaine en cours. */
async function freezeProgression(db: Database, today: string) {
  const [current, next] = await db
    .select()
    .from(week)
    .where(gte(week.endDate, today))
    .orderBy(asc(week.index))
    .limit(2)

  if (!current || !next || next.targetRunM <= current.targetRunM) return
  await scaleWeek(db, next, current.targetRunM)
}

/** Restaure la montée : la semaine suivante retrouve +10 % sur la semaine en cours. */
async function restoreProgression(db: Database, today: string) {
  const [current, next] = await db
    .select()
    .from(week)
    .where(gte(week.endDate, today))
    .orderBy(asc(week.index))
    .limit(2)

  if (!current || !next) return
  await scaleWeek(db, next, Math.round(current.targetRunM * 1.1))
}

/** Ramène une semaine à un volume cible, et ses séances avec elle. */
async function scaleWeek(db: Database, target: typeof week.$inferSelect, volumeM: number) {
  const factor = target.targetRunM === 0 ? 1 : volumeM / target.targetRunM

  await db
    .update(week)
    .set({ targetRunM: volumeM, longRunMaxM: Math.round(volumeM * 0.3) })
    .where(eq(week.id, target.id))

  const sessions = await db.select().from(session).where(eq(session.weekId, target.id))
  for (const item of sessions) {
    const prescription = item.prescription as unknown as Prescription
    await db
      .update(session)
      .set({
        prescription: {
          ...prescription,
          totalDistanceM: Math.round(prescription.totalDistanceM * factor),
          steps: prescription.steps.map((step) => ({
            ...step,
            distanceM:
              step.distanceM === undefined ? undefined : Math.round(step.distanceM * factor),
          })),
        } as unknown as Record<string, unknown>,
      })
      .where(eq(session.id, item.id))
  }
}

/** Ouvre une pause course, vélo et muscu haut autorisés si indolores (§ 5, R5). */
async function openPause(db: Database, today: string, reason: string) {
  const [existing] = await db.select().from(pause).where(isNull(pause.endDate)).limit(1)
  if (existing) return

  await db.insert(pause).values({
    type: PauseType.Injury,
    zone: null,
    startDate: today,
    allowances: {
      running: false,
      cycling: true,
      upperBodyStrength: true,
      legStrength: false,
      conditions: ['Vélo seulement si indolore'],
    },
    notes: reason,
  })
}

export async function refuseProposal(db: Database, id: number) {
  await db
    .update(proposal)
    .set({ status: ProposalStatus.Refused, decidedAt: new Date() })
    .where(eq(proposal.id, id))
}

/** Une proposition non décidée devient caduque au bout d'une semaine. */
export async function expireStaleProposals(db: Database, today: string) {
  const cutoff = new Date(`${addDays(today, -7)}T00:00:00Z`)
  await db
    .update(proposal)
    .set({ status: ProposalStatus.Expired, decidedAt: new Date() })
    .where(and(eq(proposal.status, ProposalStatus.Proposed), lt(proposal.createdAt, cutoff)))
}

export async function pendingCount(db: Database): Promise<number> {
  const rows = await db
    .select({ id: proposal.id })
    .from(proposal)
    .where(inArray(proposal.status, [ProposalStatus.Proposed]))
  return rows.length
}
