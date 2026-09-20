import { raceTimeForVdot } from './vdot'

const DAY_MS = 86_400_000
const DAYS_PER_WEEK = 7

/**
 * Semaines entre deux dates, en fraction. La progression se compte au prorata :
 * arrondir à la semaine pleine ferait sauter le gain par paliers.
 */
export function weeksAhead(from: string, to: string): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY_MS / DAYS_PER_WEEK)
}

/**
 * Semaines d'ici une échéance qu'une pause ouverte couvre : elles ne font pas
 * progresser, donc elles ne comptent pas dans le gain de bloc. Sans date de
 * reprise, la pause couvre tout ce qui vient : le moteur ne suppose pas une
 * reprise qui n'a pas été marquée (§ 5).
 */
export function pausedWeeksUntil(
  today: string,
  targetDate: string,
  openPause?: { estimatedEndDate: string | null },
): number {
  if (!openPause) return 0

  const end = openPause.estimatedEndDate
  if (!end) return weeksAhead(today, targetDate)
  return weeksAhead(today, end < targetDate ? end : targetDate)
}

/** Gain de forme attendu, plafonné, par tranche de huit semaines pleines (§ 5). */
export const VDOT_GAIN_PER_BLOCK = 0.4
export const BLOCK_WEEKS = 8

/** Corrections appliquées au temps projeté (§ 5). */
export const SECONDS_PER_ELEVATION_M = 0.5
export const HEAT_THRESHOLD_C = 18
export const HEAT_PENALTY_PER_C = 0.015

/** Bornes de la demi-largeur de l'intervalle, en part du temps projeté (§ 5). */
export const MIN_INTERVAL_SHARE = 0.01
export const MAX_INTERVAL_SHARE = 0.05

export interface ProjectionInput {
  vdot: number
  /** Vrai quand le VDOT est un plancher : une borne basse, pas une mesure (§ 5). */
  isFloor: boolean
  /** VDOT des tests successifs, du plus ancien au plus récent. */
  testHistory: number[]
  /** Semaines entre aujourd'hui et la course. */
  weeksToRace: number
  /** Parmi elles, celles couvertes par une pause : elles ne font pas progresser. */
  pausedWeeks?: number
  /** Gain attendu par bloc, quand R9 l'a recalé sur le réalisé (§ 9, P6.6). */
  gainPerBlock?: number
  distanceM: number
  elevationGainM?: number | null
  expectedTempC?: number | null
}

export interface Projection {
  /** VDOT attendu le jour de la course, gain du bloc restant compris. */
  vdot: number
  timeS: number
  lowS: number
  highS: number
}

/**
 * Gain de forme d'ici la course : +0,4 VDOT par tranche de huit semaines,
 * proratisé, et rien pour les semaines qu'une pause couvre (§ 5).
 */
export function expectedGain(
  weeksToRace: number,
  pausedWeeks = 0,
  gainPerBlock: number = VDOT_GAIN_PER_BLOCK,
): number {
  const training = Math.max(0, weeksToRace - Math.max(0, pausedWeeks))
  return (training / BLOCK_WEEKS) * gainPerBlock
}

/** Écart-type des écarts de VDOT d'un test au suivant (§ 5). */
export function testVariability(testHistory: number[]): number | undefined {
  if (testHistory.length < 2) return undefined

  const steps = testHistory.slice(1).map((value, index) => value - testHistory[index]!)
  const mean = steps.reduce((total, value) => total + value, 0) / steps.length
  const variance = steps.reduce((total, value) => total + (value - mean) ** 2, 0) / steps.length

  return Math.sqrt(variance)
}

/**
 * Demi-largeur de l'intervalle, en secondes. Elle vient de la variabilité des
 * tests, convertie en temps sur la distance, et reste bornée : sous 1 % du
 * temps projeté elle ferait croire à une précision qu'on n'a pas, au-delà de
 * 5 % elle ne dirait plus rien. Sans deux tests, un plancher de forme prend la
 * borne haute, une mesure la borne basse (§ 5).
 */
export function intervalS(
  timeS: number,
  vdot: number,
  distanceM: number,
  testHistory: number[],
  isFloor: boolean,
): number {
  const deviation = testVariability(testHistory)

  const raw =
    deviation === undefined
      ? timeS * (isFloor ? MAX_INTERVAL_SHARE : MIN_INTERVAL_SHARE)
      : Math.abs(raceTimeForVdot(Math.max(1, vdot - 2 * deviation), distanceM) - timeS)

  return Math.min(timeS * MAX_INTERVAL_SHARE, Math.max(timeS * MIN_INTERVAL_SHARE, raw))
}

/**
 * Projection du jour de course : forme attendue à cette date, corrigée du
 * dénivelé et de la chaleur, avec son intervalle (§ 5).
 */
export function project(input: ProjectionInput): Projection {
  const {
    vdot,
    isFloor,
    testHistory,
    weeksToRace,
    pausedWeeks = 0,
    gainPerBlock = VDOT_GAIN_PER_BLOCK,
    distanceM,
    elevationGainM,
    expectedTempC,
  } = input

  const projectedVdot = vdot + expectedGain(weeksToRace, pausedWeeks, gainPerBlock)
  const base = raceTimeForVdot(projectedVdot, distanceM)

  const elevation = Math.max(0, elevationGainM ?? 0) * SECONDS_PER_ELEVATION_M
  const heat =
    expectedTempC === null || expectedTempC === undefined
      ? 0
      : Math.max(0, expectedTempC - HEAT_THRESHOLD_C) * HEAT_PENALTY_PER_C

  const timeS = (base + elevation) * (1 + heat)
  const half = intervalS(timeS, projectedVdot, distanceM, testHistory, isFloor)

  return {
    vdot: projectedVdot,
    timeS: Math.round(timeS),
    lowS: Math.round(timeS - half),
    highS: Math.round(timeS + half),
  }
}

/**
 * Bornes de la demi-largeur exprimée en VDOT. Ce sont les mêmes bornes qu'en
 * temps — 1 % et 5 % du chrono projeté — relues dans l'autre unité : sur les
 * distances du plan, du 5 km au semi, un point de VDOT vaut environ 3 % du
 * chrono (§ 5).
 */
export const MIN_INTERVAL_VDOT = 0.35
export const MAX_INTERVAL_VDOT = 1.75

/**
 * Demi-largeur de l'intervalle, en VDOT. C'est la forme native de la règle du
 * § 5 — deux écarts-types des écarts entre tests consécutifs — que `intervalS`
 * ne fait que traduire en temps sur une distance. Sans deux tests, la même
 * convention qu'en temps : la borne haute pour un plancher, la basse pour une
 * mesure.
 */
export function intervalVdot(testHistory: number[], isFloor: boolean): number {
  const deviation = testVariability(testHistory)

  const raw =
    deviation === undefined ? (isFloor ? MAX_INTERVAL_VDOT : MIN_INTERVAL_VDOT) : 2 * deviation

  return Math.min(MAX_INTERVAL_VDOT, Math.max(MIN_INTERVAL_VDOT, raw))
}

/** Forme attendue à une date, avec son intervalle, sans référence à une distance. */
export interface VdotProjection {
  vdot: number
  lowVdot: number
  highVdot: number
}

/**
 * La projection réduite à ce qu'elle dit de la forme : ni dénivelé ni chaleur,
 * qui pèsent sur un chrono et non sur un indice. C'est l'unité dans laquelle
 * une prévision se compare à ce qui est arrivé, quelle que soit sa cible
 * (§ 9, P6.6).
 */
export function projectVdot(input: {
  vdot: number
  isFloor: boolean
  testHistory: number[]
  weeksAhead: number
  pausedWeeks?: number
  gainPerBlock?: number
}): VdotProjection {
  const vdot = input.vdot + expectedGain(input.weeksAhead, input.pausedWeeks, input.gainPerBlock)
  const half = intervalVdot(input.testHistory, input.isFloor)

  return { vdot, lowVdot: vdot - half, highVdot: vdot + half }
}
