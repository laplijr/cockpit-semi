import type { StrengthSetRecord } from '../domain/strength/next-load'
import { nextLoadKg } from '../domain/strength/next-load'

export interface StrengthGateway {
  saveSets(sessionId: number, sets: StrengthSetRecord[]): Promise<void>
  /** Répétitions prescrites par exercice, lues sur la séance elle-même. */
  targetReps(sessionId: number): Promise<Record<string, number>>
}

export interface NextLoad {
  exerciseId: string
  loadKg: number
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
  return nextLoadsFor(sets, targets)
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
