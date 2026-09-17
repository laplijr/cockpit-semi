import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  detectHabits,
  type ObservedDecision,
  type ObservedSession,
} from '../domain/learning/detectors'
import { HabitStatus } from '../domain/learning/habit'
import { calibrate, type Calibration } from '../domain/learning/calibration'
import { FitnessOrigin } from '../domain/fitness/fitness-point'
import { addDays, startOfWeek, weekday, type IsoDate } from '../domain/plan/calendar'
import { SessionStatus } from '../domain/plan/session'
import { ProposalStatus } from '../domain/rules/proposal-status'
import { ProposalEffect } from '../domain/rules/rules'
import type { Prescription } from '../domain/shared/prescription'
import type { Database } from '../infra/db/client'
import { calibration, feedback, fitnessPoint, habit, proposal, session } from '../infra/db/schema'

/** Fenêtre d'observation : au-delà, l'habitude d'avant ne dit plus rien d'aujourd'hui. */
export const OBSERVATION_DAYS = 120

/**
 * Relit ce qui s'est passé et met à jour les habitudes détectées. Une habitude
 * déjà décidée — acceptée ou refusée — garde son statut : la preuve se met à
 * jour, la décision reste celle de Ronan (§ 1.3).
 */
export async function detectAndStoreHabits(db: Database, today: IsoDate): Promise<number> {
  const since = addDays(today, -OBSERVATION_DAYS)
  const found = detectHabits(await observe(db, since))
  if (found.length === 0) return 0

  await db
    .insert(habit)
    .values(
      found.map((detected) => ({
        type: detected.type,
        key: detected.key,
        parameters: detected.parameters,
        matched: detected.matched,
        total: detected.total,
        confidence: detected.confidence,
        statement: detected.statement,
      })),
    )
    .onConflictDoUpdate({
      target: habit.key,
      set: {
        matched: sql`excluded.matched`,
        total: sql`excluded.total`,
        confidence: sql`excluded.confidence`,
        statement: sql`excluded.statement`,
        parameters: sql`excluded.parameters`,
      },
    })

  return found.length
}

async function observe(db: Database, since: IsoDate) {
  const [rated, decided] = await Promise.all([
    db
      .select()
      .from(session)
      .leftJoin(feedback, eq(feedback.sessionId, session.id))
      .where(
        and(
          sql`${session.date} >= ${since}`,
          inArray(session.status, [
            SessionStatus.Done,
            SessionStatus.Modified,
            SessionStatus.Skipped,
          ]),
        ),
      ),
    db
      .select()
      .from(proposal)
      .where(inArray(proposal.status, [ProposalStatus.Accepted, ProposalStatus.Refused])),
  ])

  const sessions: ObservedSession[] = rated.map((row) => ({
    code: row.session.code,
    weekday: weekday(row.session.date),
    done: row.session.status !== SessionStatus.Skipped,
    skipped: row.session.status === SessionStatus.Skipped,
    expectedRpe: (row.session.prescription as unknown as Prescription).expectedRpe,
    rpe: row.feedback?.rpe ?? null,
    sleepHours: row.feedback?.sleepHours ?? null,
  }))

  const byId = new Map(rated.map((row) => [row.session.id, row.session]))
  const decisions: ObservedDecision[] = decided.map((row) => {
    const target = row.targetId === null ? undefined : byId.get(row.targetId)
    const destination = (row.payload as { date?: string } | null)?.date
    return {
      ruleId: row.ruleId,
      effect: row.effect,
      accepted: row.status === ProposalStatus.Accepted,
      code: target?.code ?? null,
      fromWeekday: target ? weekday(target.date) : null,
      toWeekday:
        row.effect === ProposalEffect.MoveSession && destination ? weekday(destination) : null,
    }
  })

  return { sessions, decisions }
}

/**
 * Calibration de la semaine écoulée, enregistrée sur son lundi. Recalculée à
 * chaque passage : la semaine en cours se précise jusqu'à ce qu'elle se ferme.
 */
export async function calibrateWeek(db: Database, today: IsoDate): Promise<Calibration> {
  const monday = startOfWeek(today)

  const [rated, decided, tests] = await Promise.all([
    db
      .select({ prescription: session.prescription, rpe: feedback.rpe })
      .from(session)
      .innerJoin(feedback, eq(feedback.sessionId, session.id))
      .where(and(sql`${session.date} >= ${monday}`, sql`${session.date} <= ${today}`)),
    db
      .select({ status: proposal.status })
      .from(proposal)
      .where(
        and(
          inArray(proposal.status, [ProposalStatus.Accepted, ProposalStatus.Refused]),
          sql`${proposal.decidedAt} >= ${monday}`,
        ),
      ),
    db
      .select({ vdot: fitnessPoint.vdot, date: fitnessPoint.date })
      .from(fitnessPoint)
      .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
      .orderBy(desc(fitnessPoint.date))
      .limit(2),
  ])

  const measured = tests.at(0)
  const previous = tests.at(1)

  const result = calibrate({
    date: monday,
    rpe: rated.map((row) => ({
      expected: (row.prescription as unknown as Prescription).expectedRpe,
      felt: row.rpe,
    })),
    decisions: decided.map((row) => ({ accepted: row.status === ProposalStatus.Accepted })),
    /** L'écart se lit entre deux tests : le précédent projetait le suivant. */
    tests:
      measured && previous && measured.date >= monday
        ? [{ projected: previous.vdot, measured: measured.vdot }]
        : [],
  })

  await db
    .insert(calibration)
    .values(result)
    .onConflictDoUpdate({
      target: calibration.date,
      set: {
        rpeError: sql`excluded.rpe_error`,
        acceptanceRate: sql`excluded.acceptance_rate`,
        projectionGap: sql`excluded.projection_gap`,
        samples: sql`excluded.samples`,
      },
    })

  return result
}

/** Habitudes acceptées, telles que le moteur de règles les consomme. */
export async function loadAcceptedHabits(db: Database) {
  return db.select().from(habit).where(eq(habit.status, HabitStatus.Accepted))
}
