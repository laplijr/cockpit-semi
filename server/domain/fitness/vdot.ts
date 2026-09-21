/**
 * VDOT selon Jack Daniels. Distances en mètres, durées en secondes,
 * vitesses en m/min, allures en secondes par kilomètre.
 */

const HALF_MARATHON_M = 21097.5
const MARATHON_M = 42195

export const RACE_DISTANCES_M = {
  fiveK: 5000,
  tenK: 10000,
  halfMarathon: HALF_MARATHON_M,
  marathon: MARATHON_M,
} as const

/** VO2 consommé à une vitesse donnée (ml/kg/min). */
export function oxygenCost(velocityMPerMin: number): number {
  return -4.6 + 0.182258 * velocityMPerMin + 0.000104 * velocityMPerMin ** 2
}

/** Fraction de VO2max soutenable pendant une durée donnée. */
export function sustainableFraction(durationMin: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin)
  )
}

/** Vitesse (m/min) exigeant un coût en oxygène donné — inverse de `oxygenCost`. */
export function velocityForOxygenCost(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a)
}

export function vdotFromRace(distanceM: number, timeS: number): number {
  const durationMin = timeS / 60
  const velocity = distanceM / durationMin
  return oxygenCost(velocity) / sustainableFraction(durationMin)
}

/**
 * Temps de course (s) qu'un VDOT donné permet sur une distance.
 * Newton sur `vdotFromRace(d, t) - vdot`, amorcé par une estimation linéaire.
 */
export function raceTimeForVdot(vdot: number, distanceM: number): number {
  const error = (timeS: number) => vdotFromRace(distanceM, timeS) - vdot
  let timeS = (distanceM / velocityForOxygenCost(vdot * 0.85)) * 60

  for (let i = 0; i < 40; i++) {
    const current = error(timeS)
    if (Math.abs(current) < 1e-9) break
    const step = Math.max(timeS * 1e-6, 1e-4)
    const slope = (error(timeS + step) - current) / step
    timeS -= current / slope
  }

  return timeS
}

export enum TrainingZone {
  Easy = 'easy',
  Marathon = 'marathon',
  Threshold = 'threshold',
  Interval = 'interval',
  Repetition = 'repetition',
}

/**
 * Bornes de %VDOT par zone, et fraction retenue pour l'allure unique affichée
 * (§ 5) : E à 70 % comme la table publiée, T en haut de plage, les autres au
 * milieu.
 */
const ZONE_FRACTIONS: Record<TrainingZone, { slow: number; fast: number; display: number }> = {
  [TrainingZone.Easy]: { slow: 0.59, fast: 0.74, display: 0.7 },
  [TrainingZone.Marathon]: { slow: 0.75, fast: 0.84, display: 0.795 },
  [TrainingZone.Threshold]: { slow: 0.83, fast: 0.88, display: 0.88 },
  [TrainingZone.Interval]: { slow: 0.95, fast: 1.0, display: 0.975 },
  [TrainingZone.Repetition]: { slow: 1.05, fast: 1.1, display: 1.075 },
}

export interface PaceRange {
  /** Allure la plus lente de la zone, en secondes par kilomètre. */
  slowSecPerKm: number
  fastSecPerKm: number
}

function paceSecPerKm(velocityMPerMin: number): number {
  return 60000 / velocityMPerMin
}

export function paceRangeFor(vdot: number, zone: TrainingZone): PaceRange {
  const { slow, fast } = ZONE_FRACTIONS[zone]
  return {
    slowSecPerKm: paceSecPerKm(velocityForOxygenCost(vdot * slow)),
    fastSecPerKm: paceSecPerKm(velocityForOxygenCost(vdot * fast)),
  }
}

/** Allure unique affichée pour une zone. */
export function paceFor(vdot: number, zone: TrainingZone): number {
  return paceSecPerKm(velocityForOxygenCost(vdot * ZONE_FRACTIONS[zone].display))
}

/**
 * VDOT déduit d'une allure d'endurance déclarée — l'inverse exact de
 * `paceFor(vdot, Easy)`. Il borne la forme par le bas et rien de plus : une
 * allure qu'on tient en endurance dit un minimum, jamais un maximum (§ 5).
 */
export function vdotFromEasyPace(paceSecPerKm: number): number {
  const velocity = 60000 / paceSecPerKm
  return oxygenCost(velocity) / ZONE_FRACTIONS[TrainingZone.Easy].display
}

/**
 * Allure semi : moyenne de la projection sur 21 097,5 m, jamais une zone.
 * Au plancher, elle est plus lente que l'allure marathon théorique (§ 5).
 */
export function halfMarathonPace(vdot: number): number {
  return (
    raceTimeForVdot(vdot, RACE_DISTANCES_M.halfMarathon) / (RACE_DISTANCES_M.halfMarathon / 1000)
  )
}
