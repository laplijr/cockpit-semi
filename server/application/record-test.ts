import { FitnessOrigin } from '../domain/fitness/fitness-point'
import { distanceForVdot, vdotFromRace } from '../domain/fitness/vdot'
import type { IsoDate } from '../domain/plan/calendar'
import { PlanTrigger } from '../domain/plan/session'
import { TEST_DURATION_S } from '../domain/running/session-types'
import type { Clock } from '../domain/shared/clock'
import type { PlanGateway } from './ports'
import { regeneratePlan } from './regenerate-plan'

/**
 * VDOT déduit d'un test 20′ : la distance couverte en vingt minutes d'effort
 * contrôlé se lit comme un résultat de course sur cette distance.
 */
export function vdotFromTest(distanceM: number, durationS: number = TEST_DURATION_S): number {
  if (distanceM <= 0) throw new Error('La distance du test doit être positive')
  return vdotFromRace(distanceM, durationS)
}

/** Distance à couvrir en 20′ pour atteindre un VDOT visé : l'inverse du test. */
export function testDistanceForVdot(vdot: number, durationS: number = TEST_DURATION_S): number {
  return Math.round(distanceForVdot(vdot, durationS))
}

export interface FitnessPointInput {
  date: IsoDate
  vdot: number
  origin: FitnessOrigin
  isFloor: boolean
  note: string
}

export interface FitnessGateway {
  saveFitnessPoint(point: FitnessPointInput): Promise<void>
}

export interface TestPointGateway {
  /** Un test par jour : le ressaisir corrige le précédent au lieu de s'y ajouter. */
  replaceTestPoint(point: FitnessPointInput): Promise<void>
}

export interface RecordTestResult {
  date: IsoDate
  vdot: number
  weeks: number
}

/**
 * Enregistre un test de terrain : il devient le VDOT courant, non plancher,
 * et régénère le plan avec les nouvelles allures (§ 5).
 */
export async function recordTest(
  fitness: TestPointGateway,
  plans: PlanGateway,
  clock: Clock,
  input: { distanceM: number; durationS?: number; date?: IsoDate },
): Promise<RecordTestResult> {
  const durationS = input.durationS ?? TEST_DURATION_S
  const vdot = vdotFromTest(input.distanceM, durationS)
  const date = input.date ?? clock.today()

  await fitness.replaceTestPoint({
    date,
    vdot,
    origin: FitnessOrigin.Test,
    isFloor: false,
    note: `Test ${Math.round(durationS / 60)}′ · ${Math.round(input.distanceM)} m`,
  })

  const { plan } = await regeneratePlan(plans, clock, PlanTrigger.TestRecorded)
  return { date, vdot, weeks: plan.weeks.length }
}
