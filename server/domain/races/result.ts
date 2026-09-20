import { vdotFloorFrom, type ContinuousSegment } from '../fitness/floor'
import { vdotFromRace } from '../fitness/vdot'
import type { IsoDate } from '../plan/calendar'
import { RaceStatus, SegmentMode } from './race'

/**
 * Bornes de plausibilité d'un chrono, en secondes par kilomètre : en deçà
 * c'est plus rapide qu'un record du monde, au-delà ce n'est plus une course.
 * Elles n'attrapent pas une erreur de trente secondes, seulement une saisie
 * qui s'est trompée d'unité — un semi en 40′ ou en dix heures.
 */
export const MIN_PACE_S_KM = 140
export const MAX_PACE_S_KM = 1200

export interface RecordableRace {
  date: IsoDate
  status: RaceStatus
  distanceM: number
}

export interface ResultSegment {
  kmDebut: number
  kmFin: number
  mode: SegmentMode
  allureSKm: number | null
  note: string | null
}

export interface ResultFitness {
  vdot: number
  isFloor: boolean
}

/**
 * Une course se renseigne à partir du jour où elle se court, jamais avant
 * (§ 5) : un chrono écrit d'avance résoudrait une prévision avant son échéance
 * et recalerait le VDOT sur un fait qui n'a pas eu lieu.
 */
export function canRecordResult(race: RecordableRace, today: IsoDate): boolean {
  return race.status === RaceStatus.Planned && race.date <= today
}

/** La raison du refus, en toutes lettres, ou rien quand le résultat est recevable. */
export function resultRefusal(
  race: RecordableRace,
  today: IsoDate,
  resultatS: number,
): string | undefined {
  if (race.status === RaceStatus.Raced) return 'Cette course a déjà un résultat.'
  if (race.status === RaceStatus.Cancelled) return 'Une course annulée ne se renseigne pas.'
  if (race.date > today) {
    return 'Le résultat d’une course ne se saisit qu’à partir du jour de la course.'
  }

  const paceSKm = resultatS / (race.distanceM / 1000)
  if (paceSKm < MIN_PACE_S_KM || paceSKm > MAX_PACE_S_KM) {
    return 'Ce chrono ne correspond pas à la distance de la course.'
  }

  return undefined
}

/** Marcher n'est pas courir : seules les portions courues bornent la forme (§ 5). */
function runningSegments(segments: ResultSegment[]): ContinuousSegment[] {
  return segments
    .filter((segment) => segment.mode === SegmentMode.Running && segment.allureSKm !== null)
    .map((segment) => ({
      kmDebut: segment.kmDebut,
      kmFin: segment.kmFin,
      allureSKm: segment.allureSKm!,
    }))
}

/**
 * Ce qu'un résultat apprend sur la forme : une mesure quand le chrono est
 * représentatif, un plancher tiré du meilleur segment continu d'au moins 10 km
 * quand il ne l'est pas, et rien du tout quand la course ne dit rien (§ 5).
 */
export function fitnessFromResult(input: {
  distanceM: number
  resultatS: number
  representative: boolean
  segments: ResultSegment[]
}): ResultFitness | undefined {
  if (input.representative) {
    return { vdot: vdotFromRace(input.distanceM, input.resultatS), isFloor: false }
  }

  const floor = vdotFloorFrom(runningSegments(input.segments))
  return floor ? { vdot: floor.vdot, isFloor: true } : undefined
}
