import { LOAD_IMPLEMENTS, estimateFromSets } from '../domain/strength/estimated-max'
import type { StrengthSetRecord } from '../domain/strength/next-load'
import { nextLoadKg, nextRepsTarget } from '../domain/strength/next-load'

export interface SessionEstimate {
  exerciseId: string
  maxKg: number
}

export interface StrengthGateway {
  saveSets(sessionId: number, sets: StrengthSetRecord[]): Promise<void>
  /** Répétitions prescrites par exercice, lues sur la séance elle-même. */
  targetReps(sessionId: number): Promise<Record<string, number>>
  /** Les maximums estimés d'une séance, datés de son jour (P26). */
  saveSessionEstimates(sessionId: number, estimates: SessionEstimate[]): Promise<void>
}

export interface NextLoad {
  exerciseId: string
  loadKg: number
}

export interface NextFormat {
  exerciseId: string
  reps: number
}

/**
 * Enregistre les séries d'une séance de muscu et rend la charge proposée pour
 * la prochaine. Le ressenti et la charge du jour passent, eux, par
 * `recordFeedback` : une séance de muscu se clôt comme les autres.
 */
export async function recordStrengthSets(
  gateway: StrengthGateway,
  sessionId: number,
  sets: StrengthSetRecord[],
): Promise<NextLoad[]> {
  const targets = await gateway.targetReps(sessionId)
  await gateway.saveSets(sessionId, sets)
  await gateway.saveSessionEstimates(sessionId, estimatesFor(sets))
  return nextLoadsFor(sets, targets)
}

/**
 * Une estimation par exercice chargé, tirée de sa meilleure série avec une
 * réserve de 10 − RPE de la série (P26). La plus récente fait foi, pas la
 * plus haute : après une pause, le maximum redescend avec ce qui a été tenu.
 */
export function estimatesFor(sets: StrengthSetRecord[]): SessionEstimate[] {
  const exercises = [...new Set(sets.map((set) => set.exerciseId))]
  return exercises
    .filter((exerciseId) => LOAD_IMPLEMENTS[exerciseId] !== undefined)
    .flatMap((exerciseId) => {
      const maxKg = estimateFromSets(sets.filter((set) => set.exerciseId === exerciseId))
      return maxKg === null ? [] : [{ exerciseId, maxKg }]
    })
}

/** Charge suivante par exercice, à partir des séries saisies et du format visé. */
export function nextLoadsFor(
  sets: StrengthSetRecord[],
  targetReps: Record<string, number>,
): NextLoad[] {
  const exercises = [...new Set(sets.map((set) => set.exerciseId))]

  return exercises.flatMap((exerciseId) => {
    const target = targetReps[exerciseId]
    if (target === undefined) return []
    const loadKg = nextLoadKg(exerciseId, target, sets)
    return loadKg === undefined ? [] : [{ exerciseId, loadKg }]
  })
}

/**
 * Format proposé pour la prochaine séance des exercices faits au poids de
 * corps : sans charge, c'est la répétition qui progresse (§ 5, P11.3).
 */
export function nextFormatsFor(
  sets: StrengthSetRecord[],
  targetReps: Record<string, number>,
): NextFormat[] {
  const exercises = [...new Set(sets.map((set) => set.exerciseId))]

  return exercises.flatMap((exerciseId) => {
    const target = targetReps[exerciseId]
    if (target === undefined) return []
    const reps = nextRepsTarget(exerciseId, target, sets)
    return reps === undefined ? [] : [{ exerciseId, reps }]
  })
}
