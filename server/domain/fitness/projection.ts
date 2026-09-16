import { raceTimeForVdot } from './vdot'

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
export function expectedGain(weeksToRace: number, pausedWeeks = 0): number {
  const training = Math.max(0, weeksToRace - Math.max(0, pausedWeeks))
  return (training / BLOCK_WEEKS) * VDOT_GAIN_PER_BLOCK
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
    distanceM,
    elevationGainM,
    expectedTempC,
  } = input

  const projectedVdot = vdot + expectedGain(weeksToRace, pausedWeeks)
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
