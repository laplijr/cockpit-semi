import { DEFAULT_CONSTRAINTS } from '../domain/athlete/constraints'
import type { GeneratedPlan } from '../domain/plan/generate'
import { generatePlan } from '../domain/plan/generate'
import type { PlanTrigger } from '../domain/plan/session'
import type { Clock, PlanGateway } from './ports'

/**
 * Volume de course de départ quand aucune donnée ne permet de faire mieux.
 * Prudent par construction : la reprise le ramène encore à 60 % (§ 0).
 */
export const PRUDENT_START_VOLUME_M = 25_000

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
  const plan = generatePlan({
    today: clock.today(),
    constraints: athlete?.constraints ?? DEFAULT_CONSTRAINTS,
    races,
    baseWeeklyVolumeM: PRUDENT_START_VOLUME_M,
    vdot,
    openPause: openPause
      ? { startDate: openPause.startDate, estimatedEndDate: openPause.estimatedEndDate }
      : undefined,
  })

  const planVersionId = await gateway.savePlan(plan, trigger, {
    baseWeeklyVolumeM: PRUDENT_START_VOLUME_M,
    vdot,
    vdotIsFloor: fitness?.isFloor ?? true,
    provisional: plan.provisional,
  })

  return { planVersionId, plan }
}
