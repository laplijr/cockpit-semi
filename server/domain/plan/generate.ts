import type { AthleteConstraints } from '../athlete/constraints'
import type { IsoDate } from './calendar'
import { addDays, startOfWeek } from './calendar'
import { RacePriority } from '../races/race'
import type { PlanPhase, PlannedRace } from './periodization'
import { SHORT_RACE_MAX_M, buildPhases } from './periodization'
import type { PlannedSession } from './week-template'
import { buildWeekTemplate } from './week-template'
import type { PlanWeek } from './weeks'
import { COMEBACK_RATIOS, buildWeeks } from './weeks'

export interface OpenPause {
  startDate: IsoDate
  estimatedEndDate: IsoDate | null
}

export interface GeneratePlanInput {
  today: IsoDate
  constraints: AthleteConstraints
  races: PlannedRace[]
  /** Volume de course de la première semaine pleine, en mètres. */
  baseWeeklyVolumeM: number
  /** Volume hebdomadaire maximal visé sur le cycle. */
  peakWeeklyVolumeM: number
  vdot: number
  /** Pause en cours : le plan se cale alors sur la reprise, pas sur aujourd'hui. */
  openPause?: OpenPause
}

export interface GeneratedWeek extends PlanWeek {
  sessions: PlannedSession[]
}

export interface GeneratedPlan {
  /** Nul tant qu'une pause ouverte n'a pas de date de reprise estimée (§ 5). */
  startDate: IsoDate | null
  /** Vrai tant qu'une pause est ouverte : les dates bougeront à la reprise. */
  provisional: boolean
  phases: PlanPhase[]
  weeks: GeneratedWeek[]
}

/**
 * Point de départ du plan. Une pause ouverte sans date de reprise estimée ne
 * permet aucune datation : le plan est alors généré en semaines non datées
 * et les séances n'apparaissent qu'à la reprise (§ 5).
 */
export function planStartDate(today: IsoDate, openPause?: OpenPause): IsoDate | null {
  if (!openPause) return today
  if (!openPause.estimatedEndDate) return null
  return openPause.estimatedEndDate > today ? openPause.estimatedEndDate : today
}

export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const { today, constraints, races, baseWeeklyVolumeM, peakWeeklyVolumeM, vdot, openPause } = input
  const startDate = planStartDate(today, openPause)
  /** Sans date de reprise, on raisonne quand même depuis aujourd'hui pour les phases. */
  const anchor = startDate ?? today
  const upcoming = races.filter((race) => race.date >= anchor)
  const phases = buildPhases(anchor, upcoming)

  const weeks = buildWeeks({
    startDate: anchor,
    phases,
    baseWeeklyVolumeM,
    peakWeeklyVolumeM,
    comebackWeeks: openPause ? COMEBACK_RATIOS.length : 0,
  })

  // Jour de course : aucune séance. Lendemain d'une course A : repos (§ 5).
  const blockedDates = upcoming.flatMap((race) =>
    race.priority === RacePriority.A ? [race.date, addDays(race.date, 1)] : [race.date],
  )
  const shortCycleRaces = new Set(
    upcoming.filter((race) => race.distanceM <= SHORT_RACE_MAX_M).map((race) => race.id),
  )

  return {
    startDate,
    provisional: Boolean(openPause),
    phases,
    weeks: weeks.map((week) => ({
      ...week,
      // Sans date de reprise, le plan ne porte que ses phases et ses volumes.
      sessions:
        startDate === null
          ? []
          : buildWeekTemplate({
              week,
              constraints,
              vdot,
              blockedDates,
              shortCycle: shortCycleRaces.has(week.raceId),
            }).filter((session) => session.date >= startDate),
    })),
  }
}

export function weekContaining(plan: GeneratedPlan, date: IsoDate): GeneratedWeek | undefined {
  const monday = startOfWeek(date)
  return plan.weeks.find((week) => week.startDate === monday)
}

export function sessionsOn(plan: GeneratedPlan, date: IsoDate): PlannedSession[] {
  return weekContaining(plan, date)?.sessions.filter((session) => session.date === date) ?? []
}

export function nextSessionAfter(plan: GeneratedPlan, date: IsoDate): PlannedSession | undefined {
  const tomorrow = addDays(date, 1)
  return plan.weeks.flatMap((week) => week.sessions).find((session) => session.date >= tomorrow)
}
