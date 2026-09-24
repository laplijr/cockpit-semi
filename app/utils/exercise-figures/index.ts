import { CORE_FIGURES } from './core'
import { LEGS_FIGURES } from './legs'
import { MOBILITY_FIGURES } from './mobility'
import { PREVENTION_FIGURES } from './prevention'
import { PULL_FIGURES } from './pull'
import { PUSH_FIGURES } from './push'
import type { ExerciseFigure } from './skeleton'

/** Une figure par exercice de la bibliothèque, indexée par `id` (P25). */
export const FIGURES: Record<string, ExerciseFigure> = {
  ...LEGS_FIGURES,
  ...PUSH_FIGURES,
  ...PULL_FIGURES,
  ...CORE_FIGURES,
  ...PREVENTION_FIGURES,
  ...MOBILITY_FIGURES,
}
