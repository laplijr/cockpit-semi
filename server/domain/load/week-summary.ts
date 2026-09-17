import { SessionStatus } from '../plan/session'
import { Sport } from '../shared/sport'

/** Ce que la semaine du plan vise, indépendamment de ce qui a été fait. */
export interface WeekTarget {
  targetRunM: number
  light: boolean
  test: boolean
  /** Part du volume de départ pendant une reprise ; nul hors reprise. */
  comebackRatio: number | null
}

/** Une ligne de `load_daily` de la semaine. */
export interface WeekLoadDay {
  runningUa: number
  cyclingUa: number
  strengthUa: number
  otherUa: number
  totalUa: number
}

export interface WeekSessionRecord {
  sport: Sport
  status: SessionStatus
  actualDistanceM: number | null
}

export interface WeekSummary {
  targetRunM: number
  /** Distance de course réellement enregistrée ; nul tant qu'aucune course n'est faite. */
  actualRunM: number | null
  /** Réalisé moins visé, en mètres ; nul quand il n'y a rien à comparer. */
  runGapM: number | null
  loadUa: number
  loadBySport: Record<Sport, number>
  sessionsPlanned: number
  sessionsDone: number
  light: boolean
  test: boolean
  comeback: boolean
}

const DONE_STATUSES = [SessionStatus.Done, SessionStatus.Modified]

/**
 * Résumé d'une semaine du plan, lisible au survol de son graphe (§ 9, P5.14).
 * Une semaine sans charge et sans séance n'a rien à résumer : elle rend
 * `undefined` plutôt que des zéros qu'on lirait comme un échec.
 */
export function summariseWeek(
  week: WeekTarget,
  days: WeekLoadDay[],
  sessions: WeekSessionRecord[],
): WeekSummary | undefined {
  if (days.length === 0 && sessions.length === 0) return undefined

  const loadBySport = {
    [Sport.Running]: sum(days, (day) => day.runningUa),
    [Sport.Cycling]: sum(days, (day) => day.cyclingUa),
    [Sport.Strength]: sum(days, (day) => day.strengthUa),
    [Sport.Other]: sum(days, (day) => day.otherUa),
  }

  const runs = sessions.filter(
    (item) => item.sport === Sport.Running && DONE_STATUSES.includes(item.status),
  )
  const measured = runs.filter((item) => item.actualDistanceM !== null)
  const actualRunM =
    measured.length === 0 ? null : Math.round(sum(measured, (item) => item.actualDistanceM ?? 0))

  return {
    targetRunM: week.targetRunM,
    actualRunM,
    runGapM: actualRunM === null ? null : actualRunM - week.targetRunM,
    loadUa: sum(days, (day) => day.totalUa),
    loadBySport,
    sessionsPlanned: sessions.length,
    sessionsDone: sessions.filter((item) => DONE_STATUSES.includes(item.status)).length,
    light: week.light,
    test: week.test,
    comeback: week.comebackRatio !== null,
  }
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0)
}
