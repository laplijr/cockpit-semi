import { and, asc, desc, eq, gte, inArray, isNull, lt, notInArray } from 'drizzle-orm'
import { loadAcceptedHabits } from '../../application/detect-habits'
import { adjustmentsFrom } from '../../domain/learning/personal-rules'
import { addDays } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { PauseType } from '../../domain/pause/pause'
import { applyToPrescription, isSessionEffect } from '../../domain/rules/apply'
import { toCyclingPrescription } from '../../domain/cycling/convert'
import {
  ProposalStatus,
  isOutdated,
  type ProposalTrigger,
} from '../../domain/rules/proposal-status'
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
import { loadGainPerBlock, loadResolvedForecasts } from './forecast-repository'
import { athleteWeekIds } from './plan-gateway'
import { athlete, feedback, pause, proposal, race, session, week } from './schema'

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

async function buildContext(db: Database, athleteId: number, today: string): Promise<RuleContext> {
  const mine = athleteWeekIds(db, athleteId)

  // Les séances déjà jugées font foi, même si elles sont datées après aujourd'hui :
  // c'est la dernière séance notée qui ancre la fenêtre, pas la date du jour.
  const rated = await db
    .select()
    .from(session)
    .leftJoin(feedback, eq(feedback.sessionId, session.id))
    .where(
      and(
        inArray(session.status, [
          SessionStatus.Done,
          SessionStatus.Modified,
          SessionStatus.Skipped,
        ]),
        inArray(session.weekId, mine),
      ),
    )
    .orderBy(desc(session.date))
    .limit(RECENT_SESSIONS)

  const anchor = rated[0]?.session.date ?? today
  const horizon = anchor > today ? anchor : today

  const [resolved, gain] = await Promise.all([
    loadResolvedForecasts(db, athleteId),
    loadGainPerBlock(db, athleteId),
  ])

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
          inArray(session.weekId, mine),
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
      expectedRpe: prescription.expectedRpe,
    }
  })

  return {
    today: horizon,
    recent,
    upcoming,
    sameDayStrength: upcoming.filter((item) => item.sport === Sport.Strength),
    /** Les habitudes acceptées deviennent des règles R100+ (§ 5). */
    personal: adjustmentsFrom(await loadAcceptedHabits(db, athleteId)),
    forecasts: resolved,
    gainPerBlock: gain,
  }
}

/**
 * Évalue les règles et enregistre les propositions nouvelles. Une proposition
 * identique déjà en attente n'est pas dupliquée.
 */
export async function evaluateAndStore(
  db: Database,
  athleteId: number,
  today: string,
  trigger: ProposalTrigger,
): Promise<DomainProposal[]> {
  await expireOrphanProposals(db, athleteId)

  const found = evaluateRules(await buildContext(db, athleteId, today))
  if (found.length === 0) return []

  const pending = await db
    .select()
    .from(proposal)
    .where(and(eq(proposal.athleteId, athleteId), eq(proposal.status, ProposalStatus.Proposed)))

  const signature = (item: { ruleId: string; effect: string; targetId: number | null }) =>
    `${item.ruleId}|${item.effect}|${item.targetId ?? ''}`
  const known = new Set(pending.map(signature))

  const fresh = found.filter((item) => !known.has(signature({ ...item, targetId: item.target.id })))
  if (fresh.length === 0) return []

  await db.insert(proposal).values(
    fresh.map((item) => ({
      /**
       * Datée de l'horloge de l'app, pas de celle de la machine : c'est la même
       * horloge qui décide sept jours plus tard qu'elle est caduque. Sur le seed
       * daté, `defaultNow()` les faisait toutes expirer le lendemain (§ P3.5).
       */
      createdAt: new Date(`${today}T12:00:00Z`),
      athleteId,
      trigger,
      ruleId: item.ruleId,
      effect: item.effect,
      targetKind: item.target.kind,
      targetId: item.target.id,
      before: item.before,
      after: item.after,
      explanation: item.explanation,
      payload: item.payload ?? null,
    })),
  )

  return fresh
}

export async function listProposals(db: Database, athleteId: number) {
  return db
    .select()
    .from(proposal)
    .where(eq(proposal.athleteId, athleteId))
    .orderBy(desc(proposal.createdAt), desc(proposal.id))
}

/** Accepte une proposition : l'effet est appliqué, puis la décision archivée. */
export async function acceptProposal(db: Database, athleteId: number, id: number, today: string) {
  const [row] = await db
    .select()
    .from(proposal)
    .where(and(eq(proposal.id, id), eq(proposal.athleteId, athleteId)))
    .limit(1)
  if (!row) return undefined

  const effect = row.effect as ProposalEffect

  if (isSessionEffect(effect) && row.targetId !== null) {
    await updateSessionPrescription(db, athleteId, row.targetId, (prescription) =>
      applyToPrescription(prescription, effect, row.payload),
    )
  }

  if (effect === ProposalEffect.ConvertToCycling && row.targetId !== null) {
    await updateSessionPrescription(
      db,
      athleteId,
      row.targetId,
      toCyclingPrescription,
      Sport.Cycling,
    )
  }

  if (effect === ProposalEffect.MoveSession && row.targetId !== null) {
    await moveSession(db, athleteId, row.targetId, row.payload)
  }

  if (effect === ProposalEffect.CancelSession && row.targetId !== null) {
    await db
      .update(session)
      .set({ status: SessionStatus.Skipped })
      .where(
        and(eq(session.id, row.targetId), inArray(session.weekId, athleteWeekIds(db, athleteId))),
      )
  }

  if (effect === ProposalEffect.MoveRace && row.targetId !== null) {
    await moveRace(db, athleteId, row.targetId, row.payload)
  }

  if (effect === ProposalEffect.AdjustExpectedGain) {
    await adjustExpectedGain(db, athleteId, row.payload)
  }

  if (effect === ProposalEffect.FreezeProgression) await freezeProgression(db, athleteId, today)
  if (effect === ProposalEffect.RestoreProgression) await restoreProgression(db, athleteId, today)
  if (effect === ProposalEffect.ProposePause || effect === ProposalEffect.ForcePause) {
    await openPause(db, athleteId, today, row.explanation)
  }

  await db
    .update(proposal)
    .set({ status: ProposalStatus.Accepted, decidedAt: new Date() })
    .where(and(eq(proposal.id, id), eq(proposal.athleteId, athleteId)))

  return row
}

/**
 * Redater une course change le calendrier : la régénération du plan revient à
 * l'appelant, qui la déclenche après l'acceptation.
 */
async function moveRace(
  db: Database,
  athleteId: number,
  raceId: number,
  payload: Record<string, unknown> | null,
) {
  const date = payload?.date
  if (typeof date !== 'string') return

  await db
    .update(race)
    .set({ date })
    .where(and(eq(race.id, raceId), eq(race.athleteId, athleteId)))
}

/** Déplacer une séance ne change que sa date : la prescription reste la sienne. */
async function moveSession(
  db: Database,
  athleteId: number,
  sessionId: number,
  payload: Record<string, unknown> | null,
) {
  const date = payload?.date
  if (typeof date !== 'string') return

  await db
    .update(session)
    .set({ date, status: SessionStatus.Modified })
    .where(and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
}

async function updateSessionPrescription(
  db: Database,
  athleteId: number,
  sessionId: number,
  transform: (prescription: Prescription) => Prescription,
  sport?: Sport,
) {
  const [target] = await db
    .select()
    .from(session)
    .where(and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
    .limit(1)
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

/**
 * Recale la progression estimée. Elle ne vit nulle part ailleurs que sur
 * l'athlète : les projections la relisent à chaque calcul (§ 5, R9).
 */
async function adjustExpectedGain(
  db: Database,
  athleteId: number,
  payload: Record<string, unknown> | null,
) {
  const value = Number(payload?.gainPerBlock)
  if (!Number.isFinite(value)) return

  await db.update(athlete).set({ vdotGainPerBlock: value }).where(eq(athlete.id, athleteId))
}

/** Gèle la montée : la semaine suivante reprend le volume de la semaine en cours. */
async function freezeProgression(db: Database, athleteId: number, today: string) {
  const [current, next] = await db
    .select()
    .from(week)
    .where(and(gte(week.endDate, today), inArray(week.id, athleteWeekIds(db, athleteId))))
    .orderBy(asc(week.index))
    .limit(2)

  if (!current || !next || next.targetRunM <= current.targetRunM) return
  await scaleWeek(db, athleteId, next, current.targetRunM)
}

/** Restaure la montée : la semaine suivante retrouve +10 % sur la semaine en cours. */
async function restoreProgression(db: Database, athleteId: number, today: string) {
  const [current, next] = await db
    .select()
    .from(week)
    .where(and(gte(week.endDate, today), inArray(week.id, athleteWeekIds(db, athleteId))))
    .orderBy(asc(week.index))
    .limit(2)

  if (!current || !next) return
  await scaleWeek(db, athleteId, next, Math.round(current.targetRunM * 1.1))
}

/** Ramène une semaine à un volume cible, et ses séances avec elle. */
async function scaleWeek(
  db: Database,
  athleteId: number,
  target: typeof week.$inferSelect,
  volumeM: number,
) {
  const factor = target.targetRunM === 0 ? 1 : volumeM / target.targetRunM
  const mine = athleteWeekIds(db, athleteId)

  await db
    .update(week)
    .set({ targetRunM: volumeM })
    .where(and(eq(week.id, target.id), inArray(week.id, mine)))

  const sessions = await db
    .select()
    .from(session)
    .where(and(eq(session.weekId, target.id), inArray(session.weekId, mine)))
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
      .where(and(eq(session.id, item.id), inArray(session.weekId, mine)))
  }
}

/** Ouvre une pause course, vélo et muscu haut autorisés si indolores (§ 5, R5). */
async function openPause(db: Database, athleteId: number, today: string, reason: string) {
  const [existing] = await db
    .select()
    .from(pause)
    .where(and(eq(pause.athleteId, athleteId), isNull(pause.endDate)))
    .limit(1)
  if (existing) return

  await db.insert(pause).values({
    athleteId,
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

export async function refuseProposal(db: Database, athleteId: number, id: number) {
  await db
    .update(proposal)
    .set({ status: ProposalStatus.Refused, decidedAt: new Date() })
    .where(and(eq(proposal.id, id), eq(proposal.athleteId, athleteId)))
}

/**
 * Une proposition visant une séance disparue avec une régénération de plan
 * n'a plus d'objet : elle expire au lieu d'encombrer la liste.
 */
export async function expireOrphanProposals(db: Database, athleteId: number) {
  await db
    .update(proposal)
    .set({ status: ProposalStatus.Expired, decidedAt: new Date() })
    .where(
      and(
        eq(proposal.athleteId, athleteId),
        eq(proposal.status, ProposalStatus.Proposed),
        eq(proposal.targetKind, 'session'),
        notInArray(
          proposal.targetId,
          db
            .select({ id: session.id })
            .from(session)
            .where(inArray(session.weekId, athleteWeekIds(db, athleteId))),
        ),
      ),
    )
}

/** Une proposition non décidée devient caduque au bout d'une semaine. */
export async function expireStaleProposals(db: Database, athleteId: number, today: string) {
  const cutoff = new Date(`${addDays(today, -7)}T00:00:00Z`)
  await db
    .update(proposal)
    .set({ status: ProposalStatus.Expired, decidedAt: new Date() })
    .where(
      and(
        eq(proposal.athleteId, athleteId),
        eq(proposal.status, ProposalStatus.Proposed),
        lt(proposal.createdAt, cutoff),
      ),
    )
}

/** Une proposition dont la séance ou la date de destination est passée expire (P19). */
export async function expireOutdatedProposals(db: Database, athleteId: number, today: string) {
  const rows = await db
    .select({ id: proposal.id, payload: proposal.payload, targetDate: session.date })
    .from(proposal)
    .leftJoin(
      session,
      and(
        eq(proposal.targetKind, 'session'),
        eq(session.id, proposal.targetId),
        inArray(session.weekId, athleteWeekIds(db, athleteId)),
      ),
    )
    .where(and(eq(proposal.athleteId, athleteId), eq(proposal.status, ProposalStatus.Proposed)))

  const ids = rows.filter((row) => isOutdated(row, today)).map((row) => row.id)
  if (ids.length === 0) return

  await db
    .update(proposal)
    .set({ status: ProposalStatus.Expired, decidedAt: new Date() })
    .where(and(eq(proposal.athleteId, athleteId), inArray(proposal.id, ids)))
}

export async function pendingCount(db: Database, athleteId: number): Promise<number> {
  const rows = await db
    .select({ id: proposal.id })
    .from(proposal)
    .where(
      and(eq(proposal.athleteId, athleteId), inArray(proposal.status, [ProposalStatus.Proposed])),
    )
  return rows.length
}
