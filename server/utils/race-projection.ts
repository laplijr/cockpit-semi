import { desc, eq } from 'drizzle-orm'
import { FitnessOrigin } from '../domain/fitness/fitness-point'
import {
  pausedWeeksUntil,
  project,
  weeksAhead,
  type Projection,
} from '../domain/fitness/projection'
import type { Database } from '../infra/db/client'
import { loadGainPerBlock } from '../infra/db/forecast-repository'
import { createPlanGateway } from '../infra/db/plan-gateway'
import { fitnessPoint, pause } from '../infra/db/schema'
import { systemClock } from './context'

interface OpenPause {
  startDate: string
  estimatedEndDate: string | null
}

export interface ProjectionContext {
  today: string
  fitness: { vdot: number; isFloor: boolean } | undefined
  testHistory: number[]
  openPause: OpenPause | undefined
  /** Progression estimée en vigueur, que R9 peut avoir recalée (§ 5). */
  gainPerBlock: number
}

/** Tout ce dont la projection a besoin, chargé une fois pour toutes les courses. */
export async function loadProjectionContext(db: Database): Promise<ProjectionContext> {
  const [fitness, tests, latestPause, gainPerBlock] = await Promise.all([
    /** La base vient en paramètre : le seed n'a pas de `useRuntimeConfig`. */
    createPlanGateway(db).loadCurrentFitness(),
    db
      .select({ vdot: fitnessPoint.vdot })
      .from(fitnessPoint)
      .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
      .orderBy(fitnessPoint.date),
    db.select().from(pause).orderBy(desc(pause.startDate), desc(pause.id)).limit(1),
    loadGainPerBlock(db),
  ])

  return {
    today: systemClock.today(),
    fitness: fitness ?? undefined,
    testHistory: tests.map((row) => row.vdot),
    openPause: latestPause[0]?.endDate === null ? latestPause[0] : undefined,
    gainPerBlock,
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
    weeksToRace: weeksAhead(context.today, target.date),
    pausedWeeks: pausedWeeksUntil(context.today, target.date, context.openPause),
    gainPerBlock: context.gainPerBlock,
    distanceM: target.distanceM,
    elevationGainM: target.elevationGainM,
    expectedTempC: target.expectedTempC,
  })
}
