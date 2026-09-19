import { addDays, type IsoDate } from '../plan/calendar'

/**
 * Fenêtres de lecture de la page Progression (§ 9, P6) : le bloc en cours, la
 * saison, ou tout. En jours ; `null` ne borne rien.
 */
export const PERIODS = { bloc: 56, saison: 182, tout: null } as const

export type Period = keyof typeof PERIODS

/**
 * Début de la fenêtre. « Tout » remonte à 1970 et non à l'année zéro, qui
 * n'existe pas : Postgres refuse `'0000-01-01'` (P6, Progression v2).
 */
export function windowStart(today: IsoDate, period: Period): IsoDate {
  const window = PERIODS[period]
  return window === null ? '1970-01-01' : addDays(today, -window)
}
