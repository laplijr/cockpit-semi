import type { IsoDate } from '../plan/calendar'
import { addDays } from '../plan/calendar'
import { Sport } from '../shared/sport'

/** Sous 28 jours d'historique, le ratio n'a pas de sens et n'est pas affiché (§ 5). */
export const MIN_HISTORY_DAYS = 28
export const ACUTE_DAYS = 7
export const CHRONIC_DAYS = 21
/** Zone de référence affichée, jamais décisionnelle à elle seule (§ 5). */
export const RATIO_REFERENCE = { low: 0.8, high: 1.3 } as const

export interface LoadEntry {
  date: IsoDate
  sport: Sport
  /** Effort perçu, 1 à 10. */
  rpe: number
  durationMin: number
}

/** Unités arbitraires : `UA = RPE × durée_min` pour toute activité (§ 5). */
export function arbitraryUnits(entry: Pick<LoadEntry, 'rpe' | 'durationMin'>): number {
  return entry.rpe * entry.durationMin
}

export interface DailyLoad {
  date: IsoDate
  bySport: Record<Sport, number>
  total: number
}

const EMPTY_BY_SPORT: Record<Sport, number> = {
  [Sport.Running]: 0,
  [Sport.Cycling]: 0,
  [Sport.Strength]: 0,
  [Sport.Other]: 0,
}

export function dailyLoads(entries: LoadEntry[]): DailyLoad[] {
  const byDate = new Map<IsoDate, DailyLoad>()

  for (const entry of entries) {
    const day = byDate.get(entry.date) ?? {
      date: entry.date,
      bySport: { ...EMPTY_BY_SPORT },
      total: 0,
    }
    const units = arbitraryUnits(entry)
    day.bySport[entry.sport] += units
    day.total += units
    byDate.set(entry.date, day)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function sumBetween(loads: DailyLoad[], from: IsoDate, to: IsoDate): number {
  return loads
    .filter((day) => day.date >= from && day.date <= to)
    .reduce((total, day) => total + day.total, 0)
}

export interface LoadRatio {
  /** Charge des 7 derniers jours. */
  acute: number
  /** Moyenne hebdomadaire des 21 jours précédant la fenêtre aiguë. */
  chronic: number
  ratio: number
  inReferenceZone: boolean
}

/**
 * Ratio 7 j / 21 j **découplé** : la fenêtre chronique s'arrête où la fenêtre
 * aiguë commence, pour que la charge récente ne se compare pas à elle-même.
 * Indisponible tant que l'historique est trop court.
 */
export function loadRatio(
  loads: DailyLoad[],
  today: IsoDate,
  historyDays: number,
): LoadRatio | undefined {
  if (historyDays < MIN_HISTORY_DAYS) return undefined

  const acuteFrom = addDays(today, -(ACUTE_DAYS - 1))
  const chronicTo = addDays(acuteFrom, -1)
  const chronicFrom = addDays(chronicTo, -(CHRONIC_DAYS - 1))

  const acute = sumBetween(loads, acuteFrom, today)
  const chronicTotal = sumBetween(loads, chronicFrom, chronicTo)
  const chronic = (chronicTotal / CHRONIC_DAYS) * ACUTE_DAYS

  if (chronic === 0) return undefined

  const ratio = acute / chronic
  return {
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    ratio: Math.round(ratio * 100) / 100,
    inReferenceZone: ratio >= RATIO_REFERENCE.low && ratio <= RATIO_REFERENCE.high,
  }
}

/**
 * Monotonie : moyenne des charges quotidiennes divisée par leur écart-type sur
 * la fenêtre aiguë. Une monotonie élevée signale une semaine sans relief.
 */
export function monotony(loads: DailyLoad[], today: IsoDate): number | undefined {
  const from = addDays(today, -(ACUTE_DAYS - 1))
  const window: number[] = []

  for (let offset = 0; offset < ACUTE_DAYS; offset++) {
    const date = addDays(from, offset)
    window.push(loads.find((day) => day.date === date)?.total ?? 0)
  }

  const mean = window.reduce((total, value) => total + value, 0) / window.length
  if (mean === 0) return undefined

  const variance = window.reduce((total, value) => total + (value - mean) ** 2, 0) / window.length
  const deviation = Math.sqrt(variance)
  if (deviation === 0) return undefined

  return Math.round((mean / deviation) * 100) / 100
}
