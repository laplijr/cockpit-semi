import { strengthExercise } from './exercises'

/** Une série réalisée, telle qu'elle est saisie en fin de séance. */
export interface StrengthSetRecord {
  exerciseId: string
  /** Rang de la série dans l'exercice, à partir de 1. */
  index: number
  reps: number
  loadKg: number
  rpe: number
}

/** Incréments de charge : les jambes encaissent plus que le haut du corps. */
export const LOWER_BODY_STEP_KG = 5
export const UPPER_BODY_STEP_KG = 2.5

/** Au-delà, la série est jugée trop dure pour monter la charge. */
export const HARD_SET_RPE = 9
/** En dessous de cette part du format prescrit, la charge redescend. */
export const FAILED_SET_SHARE = 0.8
export const DELOAD_FACTOR = 0.95

/**
 * Charge de la prochaine séance pour un exercice : on monte quand le format a
 * été tenu sans arriver à l'échec, on redescend quand il ne l'a pas été, on
 * garde la charge entre les deux (§ 9, P4).
 */
export function nextLoadKg(
  exerciseId: string,
  targetReps: number,
  sets: StrengthSetRecord[],
): number | undefined {
  const done = sets.filter((set) => set.exerciseId === exerciseId)
  if (done.length === 0) return undefined

  const load = Math.max(...done.map((set) => set.loadKg))
  if (load === 0) return 0

  const failed = done.some((set) => set.reps < targetReps * FAILED_SET_SHARE)
  if (failed) return round(load * DELOAD_FACTOR)

  const hard = done.some((set) => set.rpe >= HARD_SET_RPE || set.reps < targetReps)
  if (hard) return round(load)

  const lowerBody = strengthExercise(exerciseId)?.lowerBody ?? false
  return round(load + (lowerBody ? LOWER_BODY_STEP_KG : UPPER_BODY_STEP_KG))
}

/** Charges au demi-kilo : c'est le pas des disques les plus fins. */
function round(value: number): number {
  return Math.round(value * 2) / 2
}
