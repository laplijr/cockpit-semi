import { addDays } from '../domain/plan/calendar'
import type { RunReplacement, SwappableSession } from '../domain/plan/ride-swap'
import { MIN_REPLACEMENT_MIN, replaceRideWithRun, rideSwapRefusal } from '../domain/plan/ride-swap'
import type { Prescription } from '../domain/shared/prescription'
import type { Clock } from '../domain/shared/clock'
import type { PlanGateway } from './ports'
import { FALLBACK_VDOT } from './regenerate-plan'

export interface StoredSession extends SwappableSession {
  weekId: number
}

export interface AppliedGiveback {
  sessionId: number
  prescription: Prescription
}

export interface SessionSwapGateway {
  loadSession(sessionId: number): Promise<StoredSession | undefined>
  loadWeek(weekId: number): Promise<{ targetRunM: number; targetCyclingMin: number } | undefined>
  loadWeekSessions(weekId: number): Promise<SwappableSession[]>
  /** La veille peut appartenir à la semaine précédente : elle se lit par date. */
  loadSessionsOn(date: string): Promise<SwappableSession[]>
  applyReplacement(input: {
    sessionId: number
    weekId: number
    prescription: Prescription
    givebacks: AppliedGiveback[]
    cyclingMinRemoved: number
  }): Promise<void>
}

/** Le VDOT courant, et rien d'autre : le cas d'usage ne lit pas le reste du plan. */
export type FitnessSource = Pick<PlanGateway, 'loadCurrentFitness'>

export type RideSwapOutcome =
  | { ok: true; replaced: StoredSession; replacement: RunReplacement }
  | { ok: false; refusal: string }

const NO_VOLUME = `Le volume de course de la semaine est déjà engagé : les endurances à venir ne peuvent pas céder les ${MIN_REPLACEMENT_MIN}′ d’une sortie de remplacement.`

/**
 * Ce que deviendrait la sortie vélo du jour si Ronan ne pouvait pas la faire,
 * calculé depuis l'état en base et sans rien y écrire. Le `POST` le recalcule
 * avant d'appliquer : le client ne décide de rien (§ 9, P6.42).
 */
export async function planRideSwap(
  gateway: SessionSwapGateway,
  plans: FitnessSource,
  clock: Clock,
  sessionId: number,
): Promise<RideSwapOutcome | undefined> {
  const ride = await gateway.loadSession(sessionId)
  if (!ride) return undefined

  const refusal = rideSwapRefusal(ride, clock.today())
  if (refusal) return { ok: false, refusal }

  const [week, weekSessions, previousDay, fitness] = await Promise.all([
    gateway.loadWeek(ride.weekId),
    gateway.loadWeekSessions(ride.weekId),
    gateway.loadSessionsOn(addDays(ride.date, -1)),
    plans.loadCurrentFitness(),
  ])
  if (!week) return { ok: false, refusal: NO_VOLUME }

  const replacement = replaceRideWithRun({
    ride,
    weekSessions,
    previousDay,
    targetRunM: week.targetRunM,
    vdot: fitness?.vdot ?? FALLBACK_VDOT,
  })

  return replacement ? { ok: true, replaced: ride, replacement } : { ok: false, refusal: NO_VOLUME }
}

/**
 * Applique le remplacement : la séance du jour devient une endurance, les
 * endurances qui l'ont payée sont raccourcies et la cible de vélo de la semaine
 * perd les minutes annulées. Aucune version de plan neuve — le générateur
 * reposerait le vélo, qu'il ne sait pas remplacé (§ 9, P6.42).
 */
export async function applyRideSwap(
  gateway: SessionSwapGateway,
  plans: FitnessSource,
  clock: Clock,
  sessionId: number,
): Promise<RideSwapOutcome | undefined> {
  const outcome = await planRideSwap(gateway, plans, clock, sessionId)
  if (!outcome?.ok) return outcome

  await gateway.applyReplacement({
    sessionId,
    weekId: outcome.replaced.weekId,
    prescription: outcome.replacement.prescription,
    givebacks: outcome.replacement.givebacks.map((giveback) => ({
      sessionId: giveback.sessionId,
      prescription: giveback.after,
    })),
    cyclingMinRemoved: outcome.replacement.cyclingMinRemoved,
  })

  return outcome
}
