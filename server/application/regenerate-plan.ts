import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../domain/athlete/constraints'
import { STANDARD_INCREASE_PCT } from '../domain/athlete/profile'
import type { GeneratedPlan } from '../domain/plan/generate'
import { addDays } from '../domain/plan/calendar'
import { LONG_RUN_SPIKE_WINDOW_DAYS, generatePlan } from '../domain/plan/generate'
import { VDOT_GAIN_PER_BLOCK } from '../domain/fitness/projection'
import { COMEBACK_RATIOS } from '../domain/plan/weeks'
import type { PlanTrigger } from '../domain/plan/session'
import { nextTestDate, recordForecasts } from './record-forecasts'
import type { Clock, PlanGateway } from './ports'

/**
 * Garde-fou de calcul quand aucun point de forme n'existe : le plancher de
 * Daniels le plus bas utilisable. Ce n'est pas une mesure — `vdotKnown` le dit
 * au générateur, qui démarre alors en endurance seule (§ 5).
 */
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
  /**
   * Sous verrou de bout en bout, et pas seulement autour de l'écriture : deux
   * régénérations qui lisent le même état avant que l'autre écrive rendraient
   * un plan qui ignore ce qui vient de le déclencher (§ 5, P8.5).
   */
  return gateway.withPlanLock(() => regenerate(gateway, clock, trigger))
}

async function regenerate(
  gateway: PlanGateway,
  clock: Clock,
  trigger: PlanTrigger,
): Promise<RegenerateResult> {
  const [athlete, races, latestPause, fitness, lastTestDate, recentRuns] = await Promise.all([
    gateway.loadAthlete(),
    gateway.loadRaces(),
    gateway.loadLatestPause(),
    gateway.loadCurrentFitness(clock.today()),
    gateway.loadLastTestDate(),
    gateway.loadRunsSince(addDays(clock.today(), -LONG_RUN_SPIKE_WINDOW_DAYS)),
  ])

  const openPause = latestPause?.endDate === null ? latestPause : undefined
  // Une pause fermée récemment ouvre encore droit à ses trois semaines de reprise.
  const resumedRecently =
    latestPause?.endDate != null &&
    latestPause.endDate >= addDays(clock.today(), -RESUMPTION_GRACE_DAYS)

  const vdotKnown = fitness != null
  const vdot = fitness?.vdot ?? FALLBACK_VDOT
  const gainPerBlock = athlete?.vdotGainPerBlock ?? VDOT_GAIN_PER_BLOCK
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
    maxWeeklyIncreasePct: athlete?.maxWeeklyIncreasePct ?? STANDARD_INCREASE_PCT,
    vdotKnown,
    recentRuns,
  })

  const planVersionId = await gateway.savePlan(plan, trigger, {
    baseWeeklyVolumeM,
    peakWeeklyVolumeM,
    vdot,
    vdotIsFloor: fitness?.isFloor ?? true,
    gainPerBlock,
    provisional: plan.provisional,
  })

  /** La boucle de crédibilité : ce qui est arrivé, puis ce qu'on annonce (§ 9, P6.6). */
  await recordForecasts(gateway, {
    today: clock.today(),
    fitness,
    gainPerBlock,
    nextTestDate: nextTestDate(plan, clock.today()),
    openPause,
  })

  return { planVersionId, plan }
}
