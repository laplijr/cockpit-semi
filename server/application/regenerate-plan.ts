import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../domain/athlete/constraints'
import type { GeneratedPlan } from '../domain/plan/generate'
import { addDays } from '../domain/plan/calendar'
import { generatePlan } from '../domain/plan/generate'
import { COMEBACK_RATIOS } from '../domain/plan/weeks'
import type { PlanTrigger } from '../domain/plan/session'
import type { Clock, PlanGateway } from './ports'

/** Faute de point de forme, le plancher de Daniels le plus bas utilisable. */
export const FALLBACK_VDOT = 30

/** Au-delà, une pause fermée n'ouvre plus droit à une reprise surveillée. */
export const RESUMPTION_GRACE_DAYS = 3

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
  const [athlete, races, latestPause, fitness, lastTestDate] = await Promise.all([
    gateway.loadAthlete(),
    gateway.loadRaces(),
    gateway.loadLatestPause(),
    gateway.loadCurrentFitness(),
    gateway.loadLastTestDate(),
  ])

  const openPause = latestPause?.endDate === null ? latestPause : undefined
  // Une pause fermée récemment ouvre encore droit à ses trois semaines de reprise.
  const resumedRecently =
    latestPause?.endDate != null &&
    latestPause.endDate >= addDays(clock.today(), -RESUMPTION_GRACE_DAYS)

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
      ? {
          startDate: openPause.startDate,
          estimatedEndDate: openPause.estimatedEndDate,
          allowances: openPause.allowances,
        }
      : undefined,
    comebackWeeks: openPause || resumedRecently ? COMEBACK_RATIOS.length : 0,
    lastTestDate,
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
