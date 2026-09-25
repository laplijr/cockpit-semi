import { LIGHT_WEEK_FACTOR } from './weeks'

/** Une semaine du plan actif, telle que le gel et le rétablissement la lisent. */
export interface RampWeek {
  index: number
  targetRunM: number
  light: boolean
}

export interface RampChange {
  index: number
  targetRunM: number
}

/**
 * Le volume dont la montée repart : la dernière semaine pleine à ce point.
 * Une semaine allégée n'en est pas une — la prendre pour référence gelait la
 * semaine pleine suivante à 70 % (§ 5, R4).
 */
function lastFullVolume(weeks: RampWeek[], index: number): number | undefined {
  return weeks.filter((item) => item.index <= index && !item.light).at(-1)?.targetRunM
}

/**
 * R4 acceptée : la semaine pleine qui suit ne monte pas, et les suivantes ne
 * remontent qu'au plafond du profil. Ne toucher que la semaine suivante
 * laissait la d'après reprendre l'escalier d'origine, donc sauter au-delà du
 * plafond. L'escalier d'origine reste une borne haute : on ne relève rien, et
 * on s'arrête dès qu'une semaine pleine y repasse sous la borne.
 */
export function frozenRamp(weeks: RampWeek[], currentIndex: number, ceiling: number): RampChange[] {
  let reference = lastFullVolume(weeks, currentIndex)
  if (reference === undefined) return []

  const changes: RampChange[] = []
  let growth = 1
  for (const item of weeks.filter((entry) => entry.index > currentIndex)) {
    const cap = Math.round(reference * (item.light ? LIGHT_WEEK_FACTOR : growth))
    if (!item.light && item.targetRunM <= cap) break
    if (item.targetRunM > cap) changes.push({ index: item.index, targetRunM: cap })
    if (!item.light) {
      reference = cap
      growth = ceiling
    }
  }
  return changes
}

/**
 * R7 acceptée : la semaine suivante retrouve la montée du profil sur la
 * dernière semaine pleine. Une semaine allégée le reste — le rétablissement
 * ne défait pas le rythme du bloc.
 */
export function restoredRamp(
  weeks: RampWeek[],
  currentIndex: number,
  ceiling: number,
): RampChange[] {
  const next = weeks.find((item) => item.index > currentIndex)
  const reference = lastFullVolume(weeks, currentIndex)
  if (!next || next.light || reference === undefined) return []

  const target = Math.round(reference * ceiling)
  return next.targetRunM < target ? [{ index: next.index, targetRunM: target }] : []
}
