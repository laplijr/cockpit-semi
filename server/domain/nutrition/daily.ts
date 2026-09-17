import { RunSessionCode } from '../running/session-types'
import { Sport } from '../shared/sport'

/**
 * Type de journée au sens nutritionnel : ce n'est pas le sport qui compte mais
 * la demande en glucides. Une journée sans course mais avec deux muscu reste
 * une journée facile ; c'est la sortie longue qui change les repères.
 */
export enum DayKind {
  Rest = 'repos',
  Easy = 'facile',
  Quality = 'qualite',
  Long = 'sortie_longue',
  Race = 'course',
}

/** Fourchette en g/kg de poids de corps et par jour. */
export type Range = readonly [number, number]

export interface DailyTargets {
  carbsGPerKg: Range
  proteinGPerKg: Range
  fatGPerKg: Range
}

/**
 * Repères de l'ACSM et de l'ISSN pour l'endurance, exprimés par kilo et par
 * jour. Les protéines et les lipides ne bougent pas avec la charge : seuls les
 * glucides suivent la journée.
 */
export const DAILY_TARGETS: Record<DayKind, DailyTargets> = {
  [DayKind.Rest]: { carbsGPerKg: [3, 5], proteinGPerKg: [1.6, 2], fatGPerKg: [1, 1.5] },
  [DayKind.Easy]: { carbsGPerKg: [5, 7], proteinGPerKg: [1.6, 2], fatGPerKg: [1, 1.5] },
  [DayKind.Quality]: { carbsGPerKg: [6, 8], proteinGPerKg: [1.6, 2], fatGPerKg: [1, 1.5] },
  [DayKind.Long]: { carbsGPerKg: [7, 10], proteinGPerKg: [1.6, 2], fatGPerKg: [1, 1.2] },
  [DayKind.Race]: { carbsGPerKg: [8, 10], proteinGPerKg: [1.6, 2], fatGPerKg: [0.8, 1] },
}

export interface DaySession {
  sport: string
  code: string
  key: boolean
  durationMin: number
}

/** La journée prend le type de sa séance la plus exigeante. */
export function dayKindOf(sessions: DaySession[], isRaceDay = false): DayKind {
  if (isRaceDay) return DayKind.Race

  const running = sessions.filter((session) => session.sport === Sport.Running)
  if (running.some((session) => session.code === RunSessionCode.LongRun)) return DayKind.Long
  if (running.some((session) => session.key)) return DayKind.Quality
  if (sessions.length === 0) return DayKind.Rest
  return DayKind.Easy
}

/** Fourchette en grammes pour un poids donné ; nulle tant qu'il n'est pas saisi. */
export function gramsFor(range: Range, weightKg: number | null): Range | null {
  if (weightKg === null || weightKg <= 0) return null
  return [Math.round(range[0] * weightKg), Math.round(range[1] * weightKg)]
}
