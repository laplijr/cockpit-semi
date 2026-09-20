import { BLOCK_WEEKS, weeksAhead } from './projection'

/**
 * Ce que le cockpit avait annoncé, confronté à ce qui est arrivé (§ 9, P6.6).
 * Tout se compte en VDOT : c'est la seule unité dans laquelle un test de vingt
 * minutes et un semi se comparent.
 */

/** Ce qu'une prévision visait : le prochain test, ou une course du calendrier. */
export enum ForecastTarget {
  Test = 'test',
  Race = 'course',
}

/**
 * Une projection à six mois et une projection à quinze jours ne se jugent pas
 * ensemble : l'horizon les sépare.
 */
export enum ForecastHorizon {
  Short = 'court',
  Medium = 'moyen',
  Long = 'long',
}

export const SHORT_HORIZON_WEEKS = 4
export const LONG_HORIZON_WEEKS = 12

/** Sous trois comparaisons, il n'y a pas de verdict : une moyenne ne dit rien. */
export const MIN_RESOLVED_FORECASTS = 3

export interface ResolvedForecast {
  issuedDate: string
  targetDate: string
  projectedVdot: number
  lowVdot: number
  highVdot: number
  /** Ce que le test ou la course a finalement mesuré. */
  actualVdot: number
}

export interface Accuracy {
  count: number
  /** Écart moyen signé : positif quand le cockpit a sous-estimé la forme. */
  biasVdot: number
  /** Écart absolu moyen : de combien il se trompe, sans le sens. */
  absoluteErrorVdot: number
  /** Part des réalisés tombés dans l'intervalle annoncé, en pourcentage. */
  coveragePct: number
  /** Portée moyenne des prévisions, en semaines : elle situe le verdict. */
  meanWeeks: number
}

export function horizonOf(issuedDate: string, targetDate: string): ForecastHorizon {
  const weeks = weeksAhead(issuedDate, targetDate)
  if (weeks < SHORT_HORIZON_WEEKS) return ForecastHorizon.Short
  if (weeks <= LONG_HORIZON_WEEKS) return ForecastHorizon.Medium
  return ForecastHorizon.Long
}

/** Écart signé d'une prévision : positif quand la forme a dépassé l'annonce. */
export function forecastGap(forecast: ResolvedForecast): number {
  return forecast.actualVdot - forecast.projectedVdot
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

/**
 * Verdict sur un lot de comparaisons résolues. Sous le seuil de comptage, il
 * n'y en a pas : l'indisponibilité est une valeur de retour, pas un zéro.
 */
export function accuracy(forecasts: ResolvedForecast[]): Accuracy | undefined {
  if (forecasts.length < MIN_RESOLVED_FORECASTS) return undefined

  const gaps = forecasts.map(forecastGap)
  const covered = forecasts.filter(
    (item) => item.actualVdot >= item.lowVdot && item.actualVdot <= item.highVdot,
  )

  return {
    count: forecasts.length,
    biasVdot: mean(gaps),
    absoluteErrorVdot: mean(gaps.map(Math.abs)),
    coveragePct: Math.round((covered.length / forecasts.length) * 100),
    meanWeeks: mean(forecasts.map((item) => weeksAhead(item.issuedDate, item.targetDate))),
  }
}

export interface HorizonAccuracy {
  horizon: ForecastHorizon
  accuracy: Accuracy | undefined
}

/** Le même verdict, horizon par horizon, dans l'ordre du plus court au plus long. */
export function accuracyByHorizon(forecasts: ResolvedForecast[]): HorizonAccuracy[] {
  return Object.values(ForecastHorizon).map((horizon) => ({
    horizon,
    accuracy: accuracy(
      forecasts.filter((item) => horizonOf(item.issuedDate, item.targetDate) === horizon),
    ),
  }))
}

/** Le gain estimé se recale aux 0,05 VDOT : plus fin serait une fausse précision. */
export const GAIN_STEP = 0.05
/** Au-delà, ce n'est plus une correction mais une autre théorie de l'entraînement. */
export const MAX_GAIN_PER_BLOCK = 1

/**
 * Progression estimée corrigée du biais mesuré : l'écart moyen ramené à la
 * semaine, puis au bloc de huit. Sans portée moyenne — toutes les prévisions
 * émises le jour de leur cible — il n'y a rien à corriger (§ 5, R9).
 */
export function adjustedGainPerBlock(current: number, verdict: Accuracy): number {
  if (verdict.meanWeeks <= 0) return current

  const corrected = current + (verdict.biasVdot / verdict.meanWeeks) * BLOCK_WEEKS
  return Math.min(MAX_GAIN_PER_BLOCK, Math.max(0, Math.round(corrected / GAIN_STEP) * GAIN_STEP))
}
