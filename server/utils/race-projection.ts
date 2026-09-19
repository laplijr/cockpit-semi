import { desc, eq } from 'drizzle-orm'
import { FitnessOrigin } from '../domain/fitness/fitness-point'
import { project, type Projection } from '../domain/fitness/projection'
import type { Database } from '../infra/db/client'
import { createPlanGateway } from '../infra/db/plan-gateway'
import { fitnessPoint, pause } from '../infra/db/schema'
import { systemClock } from './context'

const DAYS_PER_WEEK = 7
const DAY_MS = 86_400_000

function weeksBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY_MS / DAYS_PER_WEEK)
}

interface OpenPause {
  startDate: string
  estimatedEndDate: string | null
}

/**
 * Semaines d'ici la course qu'une pause ouverte couvre : elles ne font pas
 * progresser, donc elles ne comptent pas dans le gain de bloc (§ 5).
 */
function pausedWeeksUntil(today: string, raceDate: string, openPause: OpenPause | undefined) {
  if (!openPause) return 0
  const end = openPause.estimatedEndDate
  /** Sans date de reprise, la pause couvre tout ce qui vient : aucun gain. */
  if (!end) return weeksBetween(today, raceDate)
  return weeksBetween(today, end < raceDate ? end : raceDate)
}

export interface ProjectionContext {
  today: string
  fitness: { vdot: number; isFloor: boolean } | undefined
  testHistory: number[]
  openPause: OpenPause | undefined
}

/** Tout ce dont la projection a besoin, chargé une fois pour toutes les courses. */
export async function loadProjectionContext(db: Database): Promise<ProjectionContext> {
  const [fitness, tests, latestPause] = await Promise.all([
    /** La base vient en paramètre : le seed n'a pas de `useRuntimeConfig`. */
    createPlanGateway(db).loadCurrentFitness(),
    db
      .select({ vdot: fitnessPoint.vdot })
      .from(fitnessPoint)
      .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
      .orderBy(fitnessPoint.date),
    db.select().from(pause).orderBy(desc(pause.startDate)).limit(1),
  ])

  return {
    today: systemClock.today(),
    fitness: fitness ?? undefined,
    testHistory: tests.map((row) => row.vdot),
    openPause: latestPause[0]?.endDate === null ? latestPause[0] : undefined,
  }
}

export interface ProjectedRace {
  date: string
  distanceM: number
  elevationGainM?: number | null
  expectedTempC?: number | null
}

/** Nulle tant qu'aucun point de forme n'existe : sans VDOT, rien à projeter. */
export function projectRace(
  context: ProjectionContext,
  target: ProjectedRace,
): Projection | undefined {
  if (!context.fitness) return undefined

  return project({
    vdot: context.fitness.vdot,
    isFloor: context.fitness.isFloor,
    testHistory: context.testHistory,
    weeksToRace: weeksBetween(context.today, target.date),
    pausedWeeks: pausedWeeksUntil(context.today, target.date, context.openPause),
    distanceM: target.distanceM,
    elevationGainM: target.elevationGainM,
    expectedTempC: target.expectedTempC,
  })
}
