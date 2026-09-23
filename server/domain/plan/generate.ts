import type { AthleteConstraints } from '../athlete/constraints'
import type { IsoDate } from './calendar'
import { addDays, startOfWeek } from './calendar'
import { RacePriority } from '../races/race'
import type { PauseAllowances } from '../pause/pause'
import type { PlanPhase, PlannedRace } from './periodization'
import { SHORT_RACE_MAX_M, buildPhases, phaseAtWeek } from './periodization'
import { PhaseType } from './phases'
import { RunSessionCode } from '../running/session-types'
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

/** Une course réellement faite : sa date et sa distance suffisent au plafond de pic. */
export interface RecentRun {
  date: IsoDate
  distanceM: number
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
  /**
   * Courses faites dans les 30 jours avant aujourd'hui. Avec les courses
   * prévues, elles donnent la référence du plafond de pic : sans elles, une
   * reprise se brideait sur ses seules endurances de première semaine (§ 5).
   */
  recentRuns?: RecentRun[]
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
    recentRuns = [],
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

  /**
   * Jour de course : aucune séance. Veille d'une course qui structure le plan :
   * repos. Lendemain d'une course A : repos (§ 5).
   */
  const structuring = upcoming.filter((race) => race.priority !== RacePriority.C)
  const blockedDates = upcoming.flatMap((race) => {
    if (race.priority === RacePriority.C) return [race.date]
    const eveAndDay = [addDays(race.date, -1), race.date]
    return race.priority === RacePriority.A ? [...eveAndDay, addDays(race.date, 1)] : eveAndDay
  })
  const shortCycleRaces = new Set(
    upcoming.filter((race) => race.distanceM <= SHORT_RACE_MAX_M).map((race) => race.id),
  )
  const runHistory: RecentRun[] = [...recentRuns]
  let lastFullWeek: FullWeek | undefined

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
        raceDates: structuring.map((race) => race.date),
        shortCycle: week.raceId !== null && shortCycleRaces.has(week.raceId),
        longRunLimitM: longRunLimit(runHistory, week, lastFullWeek),
      })
      runHistory.push(
        ...template.sessions.map((run) => ({
          date: run.date,
          distanceM: run.prescription.totalDistanceM,
        })),
      )
      lastFullWeek = fullWeekOf(week, template.sessions) ?? lastFullWeek

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
        // Une semaine réduite annonce ce qu'elle pose, pas ce qu'elle visait. Le
        // minimum, parce que les lignes droites s'ajoutent hors du partage (§ 5).
        targetRunM: template.volumeCapped
          ? Math.min(week.targetRunM, plannedDistance(template.sessions))
          : week.targetRunM,
        longRunMaxM: template.longRunMaxM,
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

/** Fenêtre de référence du plafond de pic de la sortie longue (§ 5). */
export const LONG_RUN_SPIKE_WINDOW_DAYS = 30

/** Montée maximale de la sortie longue sur la plus longue course des 30 jours d'avant. */
export const LONG_RUN_SPIKE = 1.1

/** Phases qui n'installent pas de volume : elles ne servent pas de référence à l'affûtage. */
const UNLOADING_PHASES = [PhaseType.Taper, PhaseType.Recovery, PhaseType.Transition]

/** Dernière semaine pleine : l'affûtage réduit sa sortie longue comme son volume. */
interface FullWeek {
  targetRunM: number
  longRunM: number
}

function fullWeekOf(week: PlanWeek, runs: PlannedSession[]): FullWeek | undefined {
  if (week.light || UNLOADING_PHASES.includes(week.phaseType)) return undefined
  const longRun = runs.find((run) => run.code === RunSessionCode.LongRun)
  if (!longRun) return undefined
  return { targetRunM: week.targetRunM, longRunM: longRun.prescription.totalDistanceM }
}

/**
 * Plafond de la sortie longue tiré de l'historique : pas plus de 10 % au-dessus
 * de la plus longue course des 30 jours d'avant (Garmin-RUNSAFE, Nielsen et al.,
 * BJSM 2025) et, en affûtage, la dernière sortie longue pleine réduite dans la
 * même proportion que le volume (70 % puis 50 %, § 5).
 */
function longRunLimit(
  history: RecentRun[],
  week: PlanWeek,
  lastFullWeek: FullWeek | undefined,
): number | undefined {
  const longest = longestRunBefore(history, week.startDate)
  const bySpike = longest === undefined ? undefined : Math.round(longest * LONG_RUN_SPIKE)
  const byTaper =
    week.phaseType === PhaseType.Taper && lastFullWeek
      ? Math.round((lastFullWeek.longRunM * week.targetRunM) / lastFullWeek.targetRunM)
      : undefined
  const limits = [bySpike, byTaper].filter((limit) => limit !== undefined)
  return limits.length === 0 ? undefined : Math.min(...limits)
}

/** Plus longue course, faite ou prévue, dans les 30 jours d'avant une date ; nulle sans historique. */
function longestRunBefore(runs: RecentRun[], date: IsoDate): number | undefined {
  const from = addDays(date, -LONG_RUN_SPIKE_WINDOW_DAYS)
  const distances = runs
    .filter((run) => run.date >= from && run.date < date)
    .map((run) => run.distanceM)
  return distances.length === 0 ? undefined : Math.max(...distances)
}

function plannedDistance(runs: PlannedSession[]): number {
  return runs.reduce((total, run) => total + run.prescription.totalDistanceM, 0)
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
