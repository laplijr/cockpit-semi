import type { AthleteConstraints } from '../athlete/constraints'
import type { IsoDate } from './calendar'
import { addDays, startOfWeek } from './calendar'
import { RacePriority } from '../races/race'
import type { PauseAllowances } from '../pause/pause'
import type { PlanPhase, PlannedRace } from './periodization'
import { SHORT_RACE_MAX_M, buildPhases, phaseAtWeek } from './periodization'
import type { PlannedSupportSession } from './week-support'
import { buildWeekSupport } from './week-support'
import type { PlannedSession } from './week-template'
import { buildWeekTemplate } from './week-template'
import type { PlanWeek } from './weeks'
import { COMEBACK_RATIOS, buildWeeks } from './weeks'

export interface OpenPause {
  startDate: IsoDate
  estimatedEndDate: IsoDate | null
  /** Une blessure basse gèle la muscu jambes pendant la pause (§ 5). */
  allowances?: PauseAllowances
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
  /**
   * Nombre de semaines de reprise surveillée. C'est la *fin* d'une pause qui
   * les déclenche, pas son ouverture : sans elles, le plan repartirait au
   * volume plein le jour de la reprise (§ 0).
   */
  comebackWeeks?: number
  /** Date du dernier test 20′ enregistré, pour ne pas en replanifier un aussitôt. */
  lastTestDate?: IsoDate | null
  /** Montée hebdomadaire maximale, en pourcentage ; celle du profil (§ 5). */
  maxWeeklyIncreasePct?: number
  /**
   * Faux quand aucun point de forme n'existe : `vdot` n'est alors qu'un
   * garde-fou de calcul, et le plan démarre en endurance seule (§ 5).
   */
  vdotKnown?: boolean
}

export interface GeneratedWeek extends PlanWeek {
  sessions: PlannedSession[]
  /** Séances de vélo et de muscu posées sur les jours laissés libres (§ 5). */
  support: PlannedSupportSession[]
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
  const {
    today,
    constraints,
    races,
    baseWeeklyVolumeM,
    peakWeeklyVolumeM,
    vdot,
    openPause,
    comebackWeeks = openPause ? COMEBACK_RATIOS.length : 0,
    lastTestDate = null,
    maxWeeklyIncreasePct,
    vdotKnown = true,
  } = input
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
    comebackWeeks,
    lastTestDate,
    weeklyProgression:
      maxWeeklyIncreasePct === undefined ? undefined : 1 + maxWeeklyIncreasePct / 100,
    vdotKnown,
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
    weeks: weeks.map((week) => {
      // Sans date de reprise, le plan ne porte que ses phases et ses volumes.
      if (startDate === null) return { ...week, sessions: [], support: [] }

      const template = buildWeekTemplate({
        week,
        constraints,
        vdot,
        blockedDates,
        shortCycle: week.raceId !== null && shortCycleRaces.has(week.raceId),
      })

      const phase = phaseAtWeek(phases, week.index)
      const support = buildWeekSupport({
        week,
        constraints,
        runs: template.sessions,
        weekInPhase: phase ? week.index - phase.startWeek + 1 : week.index,
        nextRaceADate: nextRaceAOnOrAfter(upcoming, week.startDate),
        blockedDates,
        allowances: openPause?.allowances,
      })

      return {
        ...week,
        volumeCapped: template.volumeCapped,
        targetCyclingMin: support.targetCyclingMin,
        targetStrengthCount: support.targetStrengthCount,
        sessions: template.sessions.filter((session) => session.date >= startDate),
        support: support.sessions.filter((session) => session.date >= startDate),
      }
    }),
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

/** Prochaine course A à partir d'une date : la muscu s'arrête sept jours avant. */
function nextRaceAOnOrAfter(races: PlannedRace[], from: IsoDate): IsoDate | null {
  return (
    races
      .filter((item) => item.priority === RacePriority.A && item.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(0)?.date ?? null
  )
}
