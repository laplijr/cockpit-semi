import type { StructuredWorkout, WorkoutStep } from '../watch/workout'

/**
 * Une étape à courir, répétitions dépliées : c'est ce que l'écran affiche une
 * à une. La séance structurée de P6.7 sert les deux bouts du pont — la montre
 * et le téléphone lisent la même séance (§ 9, P10).
 */
export type StepTarget = WorkoutStep

/** Marque de la sortie : où on en est quand une étape commence ou finit. */
export interface RunMark {
  distanceM: number
  elapsedS: number
}

export interface StepRemaining {
  /** Mètres restants, pour une étape courue en distance. */
  remainingM: number | null
  /** Secondes restantes, pour une étape courue en durée. */
  remainingS: number | null
  /** Mètres courus au-delà de la cible, une fois l'étape franchie (§ 9, P18). */
  overM: number | null
  /** Secondes courues au-delà de la cible. */
  overS: number | null
  complete: boolean
}

export function flattenWorkout(workout: StructuredWorkout): StepTarget[] {
  return workout.blocks.flatMap((block) =>
    Array.from({ length: Math.max(1, block.repeats) }, () => block.steps).flat(),
  )
}

/**
 * Ce qui reste de l'étape en cours. Une étape porte une durée ou une distance,
 * jamais les deux (§ 9, P6.7) : c'est celle-là qu'on décompte, depuis la
 * marque où l'étape a commencé.
 *
 * Le décompte ne s'arrête pas à zéro : passé la cible, il dit le dépassement.
 * Sur la dernière étape il n'y a pas de suivante pour reprendre la main, et
 * un « reste 0 m » figé ne disait plus où on en était (§ 9, P18).
 */
export function stepRemaining(target: StepTarget, since: RunMark, now: RunMark): StepRemaining {
  if (target.durationS !== undefined) {
    const left = target.durationS - (now.elapsedS - since.elapsedS)
    return {
      remainingM: null,
      remainingS: Math.max(0, left),
      overM: null,
      overS: Math.max(0, -left),
      complete: left <= 0,
    }
  }

  if (target.distanceM !== undefined) {
    const left = target.distanceM - (now.distanceM - since.distanceM)
    return {
      remainingM: Math.max(0, left),
      remainingS: null,
      overM: Math.max(0, -left),
      overS: null,
      complete: left <= 0,
    }
  }

  /** Une étape sans cible ne se termine qu'à la main : les lignes droites. */
  return { remainingM: null, remainingS: null, overM: null, overS: null, complete: false }
}

/**
 * Écart de l'allure tenue à l'allure visée, en secondes par kilomètre.
 * Positif quand on est plus lent. Nul quand l'étape ne vise pas d'allure —
 * les côtes se courent à l'effort (§ 5, P1.5).
 */
export function paceGap(target: StepTarget, paceSecPerKm: number | null): number | null {
  if (target.paceSecPerKm === undefined || paceSecPerKm === null) return null
  return Math.round(paceSecPerKm - target.paceSecPerKm)
}

/** Tolérance d'allure d'une étape : au-delà, l'écart se dit (§ 9, P10). */
export const PACE_BAND_S = 10

export function paceOffBand(gap: number | null): boolean {
  return gap !== null && Math.abs(gap) > PACE_BAND_S
}
