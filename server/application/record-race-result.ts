import { FitnessOrigin } from '../domain/fitness/fitness-point'
import type { IsoDate } from '../domain/plan/calendar'
import { PlanTrigger } from '../domain/plan/session'
import type { RaceIncident } from '../domain/races/race'
import { fitnessFromResult, type ResultSegment } from '../domain/races/result'
import type { Clock } from '../domain/shared/clock'
import type { PlanGateway } from './ports'
import { regeneratePlan } from './regenerate-plan'

export interface RaceToRecord {
  id: number
  name: string
  date: IsoDate
  distanceM: number
}

export interface RaceResultInput {
  raceId: number
  resultatS: number
  representative: boolean
  incident: RaceIncident | null
  segments: ResultSegment[]
  notes: string | null
}

export interface RaceResultGateway {
  saveResult(input: RaceResultInput): Promise<void>
  saveFitnessPoint(point: {
    date: IsoDate
    vdot: number
    origin: FitnessOrigin
    raceId: number
    isFloor: boolean
    note: string
  }): Promise<void>
}

export interface RaceResultOutcome {
  vdot: number | null
  isFloor: boolean
  weeks: number
}

/**
 * Enregistre le chrono d'une course courue : il passe la course en « courue »,
 * pose le point de forme que ce chrono justifie — une mesure, un plancher ou
 * rien — puis régénère le plan, ce qui résout au passage la prévision émise
 * pour cette course (§ 5, § 9 P6.41). La règle de date est vérifiée par
 * l'appelant : c'est la frontière, pas le cas d'usage.
 */
export async function recordRaceResult(
  gateway: RaceResultGateway,
  plans: PlanGateway,
  clock: Clock,
  race: RaceToRecord,
  input: RaceResultInput,
): Promise<RaceResultOutcome> {
  await gateway.saveResult(input)

  const fitness = fitnessFromResult({
    distanceM: race.distanceM,
    resultatS: input.resultatS,
    representative: input.representative,
    segments: input.segments,
  })

  if (fitness) {
    await gateway.saveFitnessPoint({
      date: race.date,
      vdot: fitness.vdot,
      origin: FitnessOrigin.Race,
      raceId: race.id,
      isFloor: fitness.isFloor,
      note: fitness.isFloor
        ? `Plancher tiré du meilleur segment de ${race.name}`
        : `Chrono représentatif · ${race.name}`,
    })
  }

  const { plan } = await regeneratePlan(plans, clock, PlanTrigger.RaceRecorded)

  return {
    vdot: fitness?.vdot ?? null,
    isFloor: fitness?.isFloor ?? false,
    weeks: plan.weeks.length,
  }
}
