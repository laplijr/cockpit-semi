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

/** Ce qui s'est accumulé depuis la reprise, et la régularité qui va avec. */
export interface ProgressCounters {
  runM: number
  elevationGainM: number
  sessions: number
  longRuns: number
  /** Semaines d'affilée tenues, la plus récente comprise. */
  streak: number
}

/**
 * Part des séances prévues en dessous de laquelle la semaine n'est pas tenue.
 * La conformité se compte en séances et non en kilomètres : c'est le plan qu'on
 * suit, et le volume a déjà son graphe. Une séance manquée sur cinq laisse la
 * semaine debout, deux la font tomber.
 */
export const CONFORMING_SHARE = 0.8

export interface ProgressWeek {
  summary: WeekSummary | undefined
  /**
   * Vrai quand le moteur ou une pause a lui-même allégé la semaine : elle gèle
   * la série au lieu de la casser. Le moteur doit pouvoir dire de lever le pied
   * sans que ça coûte quelque chose (§ 1).
   */
  excused: boolean
}

/**
 * Une semaine compte quand quatre séances sur cinq ont été faites. En dessous,
 * et sans cause déclarée, la série repart de zéro.
 */
export function isConforming(summary: WeekSummary): boolean {
  if (summary.sessionsPlanned === 0) return false
  return summary.sessionsDone >= summary.sessionsPlanned * CONFORMING_SHARE
}

/**
 * Série de semaines conformes, la plus récente en tête de la liste reçue.
 * Une semaine allégée ou couverte par une pause est sautée : elle ne fait ni
 * monter ni tomber la série (§ 9, P6.5).
 */
export function conformingStreak(weeks: ProgressWeek[]): number {
  let streak = 0

  for (const week of weeks) {
    if (!week.summary) continue
    if (week.excused || week.summary.light) continue
    if (!isConforming(week.summary)) break
    streak += 1
  }

  return streak
}

export interface CountedSession {
  status: SessionStatus
  sport: Sport
  code: string
  actualDistanceM: number | null
  elevationGainM: number | null
}

/**
 * Le chemin parcouru depuis la reprise : des totaux, pas des récompenses. Ils
 * se lisent avec la série, qu'une semaine allégée gèle (§ 1 : jamais de série
 * de jours consécutifs, qui pousserait à s'entraîner contre `readiness`).
 */
export function progressCounters(
  sessions: CountedSession[],
  weeks: ProgressWeek[],
  longRunCode: string,
): ProgressCounters {
  const done = sessions.filter((item) => DONE_STATUSES.includes(item.status))
  const runs = done.filter((item) => item.sport === Sport.Running)

  return {
    runM: Math.round(sum(runs, (item) => item.actualDistanceM ?? 0)),
    elevationGainM: Math.round(sum(done, (item) => item.elevationGainM ?? 0)),
    sessions: done.length,
    longRuns: runs.filter((item) => item.code === longRunCode).length,
    streak: conformingStreak(weeks),
  }
}
