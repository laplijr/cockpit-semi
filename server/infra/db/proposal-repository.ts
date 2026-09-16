import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { addDays } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { applyToPrescription, isSessionEffect } from '../../domain/rules/apply'
import { ProposalStatus, type ProposalTrigger } from '../../domain/rules/proposal-status'
import {
  evaluateRules,
  type Proposal as DomainProposal,
  type ProposalEffect,
  type RuleContext,
  type SessionOutcome,
  type UpcomingSession,
} from '../../domain/rules/rules'
import type { RunSessionCode, Prescription } from '../../domain/running/session-types'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { feedback, proposal, session } from './schema'

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
export async function acceptProposal(db: Database, id: number) {
  const [row] = await db.select().from(proposal).where(eq(proposal.id, id)).limit(1)
  if (!row) return undefined

  const effect = row.effect as ProposalEffect

  if (isSessionEffect(effect) && row.targetId !== null) {
    const [target] = await db.select().from(session).where(eq(session.id, row.targetId)).limit(1)
    if (target) {
      const updated = applyToPrescription(target.prescription as unknown as Prescription, effect)
      await db
        .update(session)
        .set({
          prescription: updated as unknown as Record<string, unknown>,
          status: SessionStatus.Modified,
        })
        .where(eq(session.id, row.targetId))
    }
  }

  await db
    .update(proposal)
    .set({ status: ProposalStatus.Accepted, decidedAt: new Date() })
    .where(eq(proposal.id, id))

  return row
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
