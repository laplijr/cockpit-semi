import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../domain/athlete/constraints'
import type { GeneratedPlan } from '../domain/plan/generate'
import { generatePlan } from '../domain/plan/generate'
import type { PlanTrigger } from '../domain/plan/session'
import type { Clock, PlanGateway } from './ports'

/** Faute de point de forme, le plancher de Daniels le plus bas utilisable. */
export const FALLBACK_VDOT = 30

export interface RegenerateResult {
  planVersionId: number
  plan: GeneratedPlan
}

/**
 * Régénère le plan actif depuis l'état courant : courses à venir, pause
 * ouverte, dernier point de forme, contraintes de l'athlète.
 */
export async function regeneratePlan(
  gateway: PlanGateway,
  clock: Clock,
  trigger: PlanTrigger,
): Promise<RegenerateResult> {
  const [athlete, races, openPause, fitness] = await Promise.all([
    gateway.loadAthlete(),
    gateway.loadRaces(),
    gateway.loadOpenPause(),
    gateway.loadCurrentFitness(),
  ])

  const vdot = fitness?.vdot ?? FALLBACK_VDOT
  const baseWeeklyVolumeM = athlete?.startWeeklyVolumeM ?? DEFAULT_START_VOLUME_M
  const peakWeeklyVolumeM = athlete?.peakWeeklyVolumeM ?? DEFAULT_PEAK_VOLUME_M

  const plan = generatePlan({
    today: clock.today(),
    constraints: athlete?.constraints ?? DEFAULT_CONSTRAINTS,
    races,
    baseWeeklyVolumeM,
    peakWeeklyVolumeM,
    vdot,
    openPause: openPause
      ? { startDate: openPause.startDate, estimatedEndDate: openPause.estimatedEndDate }
      : undefined,
  })

  const planVersionId = await gateway.savePlan(plan, trigger, {
    baseWeeklyVolumeM,
    peakWeeklyVolumeM,
    vdot,
    vdotIsFloor: fitness?.isFloor ?? true,
    provisional: plan.provisional,
  })

  return { planVersionId, plan }
}
