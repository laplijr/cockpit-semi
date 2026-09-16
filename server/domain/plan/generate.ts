import type { AthleteConstraints } from '../athlete/constraints'
import type { IsoDate } from './calendar'
import { addDays, startOfWeek } from './calendar'
import type { PlanPhase, PlannedRace } from './periodization'
import { buildPhases } from './periodization'
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
  vdot: number
  /** Pause en cours : le plan se cale alors sur la reprise, pas sur aujourd'hui. */
  openPause?: OpenPause
}

export interface GeneratedWeek extends PlanWeek {
  sessions: PlannedSession[]
}

export interface GeneratedPlan {
  startDate: IsoDate
  /** Vrai tant qu'une pause est ouverte : les dates bougeront à la reprise. */
  provisional: boolean
  phases: PlanPhase[]
  weeks: GeneratedWeek[]
}

/**
 * Point de départ du plan. Une pause ouverte le repousse à la reprise estimée,
 * faute de quoi le plan daterait de séances impossibles à faire (§ 0).
 */
export function planStartDate(today: IsoDate, openPause?: OpenPause): IsoDate {
  if (!openPause) return today
  const resumption = openPause.estimatedEndDate ?? today
  return resumption > today ? resumption : today
}

export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const { today, constraints, races, baseWeeklyVolumeM, vdot, openPause } = input
  const startDate = planStartDate(today, openPause)
  const upcoming = races.filter((race) => race.date >= startDate)
  const phases = buildPhases(startDate, upcoming)

  const weeks = buildWeeks({
    startDate,
    phases,
    baseWeeklyVolumeM,
    comebackWeeks: openPause ? COMEBACK_RATIOS.length : 0,
  })

  return {
    startDate,
    provisional: Boolean(openPause),
    phases,
    weeks: weeks.map((week) => ({
      ...week,
      sessions: buildWeekTemplate({ week, constraints, vdot }).filter(
        (session) => session.date >= startDate,
      ),
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
