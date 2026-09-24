import type { Projection } from './projection'
import { frenchSignedDuration } from '../shared/french'

/**
 * Un objectif à trois niveaux, en secondes. Le réaliste est le seul obligatoire ;
 * l'ambition et le plancher bornent le risque de part et d'autre (§ 5).
 */
export interface ObjectiveLevels {
  ambitionS: number | null
  realisticS: number | null
  floorS: number | null
}

/**
 * Proposition du moteur : les trois bornes de l'intervalle déjà calculé. Rien
 * n'est écrit sans décision de Ronan — c'est une valeur proposée, pas fixée.
 */
export function proposeLevels(projection: Projection): ObjectiveLevels {
  return {
    ambitionS: projection.lowS,
    realisticS: projection.timeS,
    floorS: projection.highS,
  }
}

/**
 * Ambition < réaliste < plancher, strictement. Un niveau absent ne casse pas
 * l'ordre : on compare seulement ceux qui sont là.
 */
export function levelsAreOrdered(levels: ObjectiveLevels): boolean {
  const present = [levels.ambitionS, levels.realisticS, levels.floorS].filter(
    (value): value is number => value !== null,
  )

  return present.every((value, index) => index === 0 || present[index - 1]! < value)
}

/** Vrai tant qu'aucun des trois niveaux n'est fixé : l'objectif reste à poser. */
export function objectiveIsUnset(levels: ObjectiveLevels): boolean {
  return levels.ambitionS === null && levels.realisticS === null && levels.floorS === null
}

/**
 * La projection dite contre ce qu'elle vise (P20) : « projection +0:45 sur
 * l'objectif ». La paire nue « 2:05:02 → 2:05:47 » se lisait comme un
 * intervalle. Positif = plus lent que la cible.
 */
export function projectionVerdict(gapS: number, target: 'objectif' | 'record'): string {
  const against = target === 'record' ? 'le record' : "l'objectif"
  if (Math.round(gapS) === 0) return `projection sur ${against}`
  return `projection ${frenchSignedDuration(gapS)} sur ${against}`
}
