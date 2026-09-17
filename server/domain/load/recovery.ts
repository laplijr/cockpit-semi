import type { IsoDate } from '../plan/calendar'

/**
 * Ce que la récupération laisse comme traces mesurables : le sommeil déclaré et
 * les jours sans rien. Aucune de ces deux mesures ne juge une séance — elles
 * disent si le corps a eu le temps d'encaisser (§ 9, P6).
 */
export const SHORT_NIGHT_HOURS = 6

export interface RecoveryInput {
  /** Une entrée par ressenti portant une durée de sommeil. */
  nights: number[]
  /** Jours de la période, avec le nombre de séances faites ce jour-là. */
  days: { date: IsoDate; sessions: number }[]
}

export interface Recovery {
  /** Sommeil moyen déclaré, en heures ; nul sans déclaration. */
  sleepMeanH: number | null
  shortNights: number
  /** Part des nuits sous six heures, 0 à 1 ; nulle sans déclaration. */
  shortNightShare: number | null
  /** Jours sans aucune séance, ramenés à une semaine ; nul sans jour observé. */
  restDaysPerWeek: number | null
  samples: { nights: number; days: number }
}

export function summariseRecovery(input: RecoveryInput): Recovery {
  const { nights, days } = input
  const short = nights.filter((hours) => hours < SHORT_NIGHT_HOURS).length
  const rest = days.filter((day) => day.sessions === 0).length

  const round = (value: number, decimals = 1) => Math.round(value * 10 ** decimals) / 10 ** decimals

  return {
    sleepMeanH:
      nights.length === 0 ? null : round(nights.reduce((sum, h) => sum + h, 0) / nights.length),
    shortNights: short,
    shortNightShare: nights.length === 0 ? null : round(short / nights.length, 2),
    restDaysPerWeek: days.length === 0 ? null : round((rest / days.length) * 7),
    samples: { nights: nights.length, days: days.length },
  }
}
