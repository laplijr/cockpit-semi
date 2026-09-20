import { confidence } from './confidence'
import { FitnessOrigin } from './fitness-point'
import { project } from './projection'

/**
 * La confiance de tenir l'objectif ne vit que dans le cadran du cockpit, au
 * présent. Sa trajectoire se reconstruit ici : à chaque point de forme, ce que
 * la projection disait **ce jour-là**, avec l'historique de tests connu à ce
 * moment et les semaines de pause déjà posées (§ 9, P6.5).
 */
export enum ConfidenceEvent {
  /** Un test 20′ a recalé le VDOT. */
  Test = 'test',
  /** Un chrono de course a recalé le VDOT. */
  Race = 'course',
  /** Le point de forme est un plancher : une borne basse, pas une mesure. */
  Floor = 'plancher',
  /** Une pause couvrait des semaines d'ici la course. */
  Paused = 'pause',
}

export interface FitnessPointRecord {
  date: string
  vdot: number
  isFloor: boolean
  origin: string
}

/** Une pause, telle qu'elle se lit en base : sa fin est nulle tant qu'elle dure. */
export interface PauseWindow {
  startDate: string
  endDate: string | null
  estimatedEndDate: string | null
}

export interface ConfidenceTargetRace {
  date: string
  distanceM: number
  elevationGainM: number | null
  expectedTempC: number | null
  /** Chrono visé, ou record à battre ; nul tant qu'il n'est pas fixé. */
  targetS: number | null
}

export interface ConfidencePoint {
  date: string
  /** Pourcentage de chances de tenir l'objectif, vu de ce jour-là. */
  confidencePct: number
  /** Chrono projeté ce jour-là. */
  projectedS: number
  /**
   * Les bornes de la projection de ce jour-là — l'incertitude, pas la
   * confiance. C'est l'intervalle que la couverture de P6.6 confronte au
   * réalisé : le graphe en fait son enveloppe plutôt que d'en inventer une
   * depuis la confiance (§ 9, P6.40).
   */
  lowS: number
  highS: number
  /** Ce qui explique ce point, du plus parlant au moins parlant. */
  events: ConfidenceEvent[]
}

const DAY_MS = 86_400_000
const DAYS_PER_WEEK = 7

function weeksBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY_MS / DAYS_PER_WEEK)
}

/**
 * Semaines entre deux dates qu'une pause couvre. Une pause sans fin déclarée
 * couvre tout ce qui vient : le moteur ne suppose pas une reprise qui n'a pas
 * été marquée (§ 5).
 */
function pausedWeeks(from: string, to: string, pauses: PauseWindow[]): number {
  return pauses.reduce((total, window) => {
    const start = window.startDate > from ? window.startDate : from
    const end = window.endDate ?? window.estimatedEndDate ?? to
    const stop = end < to ? end : to
    return total + weeksBetween(start, stop)
  }, 0)
}

function eventsOf(point: FitnessPointRecord, paused: number): ConfidenceEvent[] {
  const events: ConfidenceEvent[] = []

  if (point.origin === FitnessOrigin.Test) events.push(ConfidenceEvent.Test)
  if (point.origin === FitnessOrigin.Race) events.push(ConfidenceEvent.Race)
  if (point.isFloor) events.push(ConfidenceEvent.Floor)
  if (paused > 0) events.push(ConfidenceEvent.Paused)

  return events
}

/**
 * Un point de confiance par point de forme, dans l'ordre du temps. Sans
 * objectif, la série est vide : une confiance sans cible ne veut rien dire, et
 * l'écran préfère ne rien montrer plutôt qu'un chiffre inventé (§ 5).
 */
export function confidenceHistory(
  points: FitnessPointRecord[],
  race: ConfidenceTargetRace,
  pauses: PauseWindow[] = [],
  gainPerBlock?: number,
): ConfidencePoint[] {
  if (race.targetS === null) return []

  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date))

  return ordered
    .filter((point) => point.date <= race.date)
    .map((point, index) => {
      const paused = pausedWeeks(point.date, race.date, pauses)

      const projection = project({
        vdot: point.vdot,
        isFloor: point.isFloor,
        /** L'historique connu ce jour-là, pas celui d'aujourd'hui. */
        testHistory: ordered
          .slice(0, index + 1)
          .filter((item) => item.origin === FitnessOrigin.Test)
          .map((item) => item.vdot),
        weeksToRace: weeksBetween(point.date, race.date),
        pausedWeeks: paused,
        gainPerBlock,
        distanceM: race.distanceM,
        elevationGainM: race.elevationGainM,
        expectedTempC: race.expectedTempC,
      })

      return {
        date: point.date,
        confidencePct: confidence(projection, { targetS: race.targetS }) ?? 0,
        projectedS: projection.timeS,
        lowS: projection.lowS,
        highS: projection.highS,
        events: eventsOf(point, paused),
      }
    })
}
