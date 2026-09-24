import type { ExerciseTechnique } from './muscles'
import { CARE_TECHNIQUE } from './technique-care'
import { LEGS_TECHNIQUE } from './technique-legs'
import { UPPER_TECHNIQUE } from './technique-upper'

/**
 * Une fiche par exercice de `STRENGTH_EXERCISES`, indexée par `id` (P25).
 * Elle vit à côté de la bibliothèque plutôt que dedans : `exercises.ts` fait
 * déjà huit cents lignes, et la fiche se relit à part.
 */
export const STRENGTH_TECHNIQUE: Record<string, ExerciseTechnique> = {
  ...LEGS_TECHNIQUE,
  ...UPPER_TECHNIQUE,
  ...CARE_TECHNIQUE,
}
