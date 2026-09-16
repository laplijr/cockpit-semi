export const MONDAY = 1
export const SUNDAY = 7

export interface AthleteConstraints {
  /** Jours où l'athlète peut s'entraîner, 1 = lundi … 7 = dimanche. */
  availableDays: number[]
  /** Jour de la sortie longue ; par défaut le dernier jour disponible. */
  longRunDay?: number
  /** Jours qui restent faciles quoi qu'il arrive (« lundi facile », § 5). */
  easyDays?: number[]
  notes?: string[]
}

export const DEFAULT_CONSTRAINTS: AthleteConstraints = { availableDays: [] }
