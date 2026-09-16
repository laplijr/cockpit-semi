import { and, asc, eq, lte } from 'drizzle-orm'
import { recordFeedback, skipSession } from '../server/application/record-feedback'
import { recordTest, testDistanceForVdot } from '../server/application/record-test'
import { resumePause } from '../server/application/resume-pause'
import { Sensation, type Pain } from '../server/domain/load/feedback'
import { addDays } from '../server/domain/plan/calendar'
import { SessionStatus } from '../server/domain/plan/session'
import { fixedClock } from '../server/domain/shared/clock'
import type { Database } from '../server/infra/db/client'
import {
  createFeedbackGateway,
  createFitnessGateway,
  createPauseGateway,
} from '../server/infra/db/feedback-gateway'
import { createPlanGateway } from '../server/infra/db/plan-gateway'
import { expireStaleProposals } from '../server/infra/db/proposal-repository'
import { fitnessPoint, session } from '../server/infra/db/schema'
import { between, createRandom, type Scenario } from './scenarios'

/** Part des séances prévues qui sont manquées, sans ressenti. */
const MISS_RATE = 0.1
/** Zone surveillée à la reprise, dont la douleur décroît sur trois semaines (§ 0). */
const WATCH_ZONE = 'genou droit, face postérieure'
const COMEBACK_DAYS = 21

interface Progress {
  sessionsDone: number
  sessionsMissed: number
  tests: number
  lastVdot: number
}

/** Douleur résiduelle du genou : 3/10 au premier jour, nulle au bout de trois semaines. */
function residualPain(dayIndex: number): Pain | null {
  if (dayIndex >= COMEBACK_DAYS) return null
  const intensity = Math.round(3 * (1 - dayIndex / COMEBACK_DAYS))
  return intensity <= 0 ? null : { zone: WATCH_ZONE, intensity }
}

/** Sensations cohérentes avec l'écart entre le RPE réel et le RPE attendu. */
function sensationsFor(delta: number): Sensation[] {
  if (delta >= 2) return [Sensation.HeavyLegs, Sensation.Breathless]
  if (delta >= 1) return [Sensation.HeavyLegs]
  if (delta <= -1) return [Sensation.FreshLegs]
  return [Sensation.Easy]
}

interface PlannedRow {
  id: number
  date: string
  code: string
  key: boolean
  prescription: { totalDistanceM: number; expectedRpe: number; steps: { paceSecPerKm?: number }[] }
}

async function plannedOn(db: Database, date: string): Promise<PlannedRow[]> {
  const rows = await db
    .select()
    .from(session)
    .where(and(eq(session.date, date), eq(session.status, SessionStatus.Planned)))
    .orderBy(asc(session.id))

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    code: row.code,
    key: row.key,
    prescription: row.prescription as PlannedRow['prescription'],
  }))
}

/** Durée prévue d'une séance, déduite de sa distance et de son allure. */
function plannedMinutes(row: PlannedRow): number {
  const pace = row.prescription.steps.find((step) => step.paceSecPerKm)?.paceSecPerKm ?? 420
  return Math.max(15, Math.round(((row.prescription.totalDistanceM / 1000) * pace) / 60))
}

async function currentVdot(db: Database): Promise<number> {
  const [row] = await db
    .select()
    .from(fitnessPoint)
    .orderBy(asc(fitnessPoint.date))
    .limit(50)
    .then((rows) => rows.slice(-1))
  return row?.vdot ?? 33
}

/**
 * Rejoue l'historique jour par jour, de la reprise au jour simulé, en passant
 * par les mêmes cas d'usage que l'application : rien n'est inséré à la main.
 */
export async function simulate(db: Database, scenario: Scenario): Promise<Progress> {
  if (!scenario.resumeDate) return { sessionsDone: 0, sessionsMissed: 0, tests: 0, lastVdot: 33 }

  const random = createRandom(scenario.seed)
  const plans = createPlanGateway(db)
  const feedbackGateway = createFeedbackGateway(db)

  await resumePause(createPauseGateway(db), plans, fixedClock(scenario.resumeDate))

  const progress: Progress = {
    sessionsDone: 0,
    sessionsMissed: 0,
    tests: 0,
    lastVdot: await currentVdot(db),
  }

  const lastWeekStart = addDays(scenario.simulatedDay, -6)

  for (let date = scenario.resumeDate; date <= scenario.simulatedDay; date = addDays(date, 1)) {
    const clock = fixedClock(date)
    // Le cron quotidien tourne aussi dans la simulation : sans lui, les
    // propositions jamais décidées s'accumuleraient indéfiniment.
    await expireStaleProposals(db, date)
    const dayIndex = Math.round((Date.parse(date) - Date.parse(scenario.resumeDate)) / 86_400_000)

    for (const row of await plannedOn(db, date)) {
      if (row.code === 'test') {
        const target = progress.lastVdot + scenario.vdotGainPerTest
        const distanceM = testDistanceForVdot(target)

        // La séance est d'abord close, sinon la régénération la remplacerait
        // et le test apparaîtrait comme manqué.
        await recordFeedback(feedbackGateway, clock, {
          sessionId: row.id,
          rpe: row.prescription.expectedRpe,
          sensations: sensationsFor(0),
          sleepHours: 7.5,
          pain: residualPain(dayIndex),
          durationMin: plannedMinutes(row),
          distanceM: row.prescription.totalDistanceM,
          notes: `Test 20′ : ${distanceM} m`,
        })

        const result = await recordTest(createFitnessGateway(db), plans, clock, {
          distanceM,
          date,
        })
        progress.lastVdot = result.vdot
        progress.tests += 1
        progress.sessionsDone += 1
        continue
      }

      if (random() < MISS_RATE) {
        await skipSession(feedbackGateway, row.id)
        progress.sessionsMissed += 1
        continue
      }

      // Dernière semaine : deux séances clés d'affilée nettement trop dures,
      // pour qu'au moins une règle se déclenche dans l'état final.
      const forceHard = date >= lastWeekStart && row.key
      const delta = forceHard ? 2 : Math.round(between(random, -1, 1))
      const rpe = Math.min(10, Math.max(1, row.prescription.expectedRpe + delta))
      const spread = between(random, 0.95, 1.05)

      await recordFeedback(feedbackGateway, clock, {
        sessionId: row.id,
        rpe,
        sensations: sensationsFor(delta),
        sleepHours: Math.round(between(random, 6.5, 8) * 2) / 2,
        pain: residualPain(dayIndex),
        durationMin: Math.round(plannedMinutes(row) * spread),
        distanceM: Math.round(row.prescription.totalDistanceM * spread),
        notes: null,
      })
      progress.sessionsDone += 1
    }
  }

  // Les séances passées jamais traitées restent des séances manquées.
  const stale = await db
    .select({ id: session.id })
    .from(session)
    .where(and(lte(session.date, scenario.simulatedDay), eq(session.status, SessionStatus.Planned)))

  for (const row of stale) {
    await skipSession(feedbackGateway, row.id)
    progress.sessionsMissed += 1
  }

  return progress
}
