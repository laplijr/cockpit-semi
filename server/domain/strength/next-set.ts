import { EMPTY_BAR_KG, LoadImplement, intensityShare } from './estimated-max'
import { DELOAD_FACTOR } from './next-load'

/**
 * Le réglage d'une série à la suivante, en salle (P27). C'est la règle de
 * `nextLoadKg` appliquée de série en série : ratée à l'échec, la suivante
 * redescend de 5 % ; tenue avec quatre en réserve ou plus, elle monte de 5 % ;
 * sinon rien. Une proposition, jamais appliquée seule.
 */
export const EASY_RESERVE = 4
const RAISE_FACTOR = 1.05

export interface DoneSet {
  loadKg: number
  reps: number
  targetReps: number
  /** Répétitions restées sous le pied, 4 voulant dire « 4 ou plus ». */
  reserve: number
}

export interface SetAdjustment {
  loadKg: number
  /** Pourquoi, en une demi-phrase : « série 1 à l'échec ». */
  reason: string
}

const STEP_KG: Record<LoadImplement, number> = {
  [LoadImplement.Barbell]: 2.5,
  [LoadImplement.Dumbbell]: 2,
}

function toStep(value: number, step: number, direction: -1 | 1, from: number): number {
  const rounded = Math.round(value / step) * step
  /** Au moins un pas dans le bon sens : sinon la proposition ne propose rien. */
  if (direction < 0) return Math.min(rounded, from - step)
  return Math.max(rounded, from + step)
}

export function adjustNextSet(
  done: DoneSet,
  setNumber: number,
  implement: LoadImplement | undefined,
): SetAdjustment | null {
  if (done.loadKg <= 0) return null
  const step = implement ? STEP_KG[implement] : 0.5
  const floor = implement === LoadImplement.Barbell ? EMPTY_BAR_KG : step

  if (done.reserve === 0 && done.reps < done.targetReps) {
    const loadKg = Math.max(floor, toStep(done.loadKg * DELOAD_FACTOR, step, -1, done.loadKg))
    return loadKg < done.loadKg ? { loadKg, reason: `série ${setNumber} à l’échec` } : null
  }
  if (done.reserve >= EASY_RESERVE) {
    return {
      loadKg: toStep(done.loadKg * RAISE_FACTOR, step, 1, done.loadKg),
      reason: `série ${setNumber} avec ${EASY_RESERVE} en réserve ou plus`,
    }
  }
  return null
}

/** La réserve se stocke comme RPE de la série : pas de nouvelle colonne (P27). */
export function rpeFromReserve(reserve: number): number {
  return 10 - Math.min(EASY_RESERVE, Math.max(0, reserve))
}

export interface WarmupSet {
  loadKg: number
  reps: number
}

/**
 * Les séries d'échauffement d'un exercice à la barre dosé à 75 % ou plus :
 * la barre à vide × 8, puis environ deux tiers de la charge × 4. Marquées É,
 * jamais enregistrées. Un calage du jour en tient lieu.
 */
export function warmupSets(
  implement: LoadImplement | undefined,
  intensity: string | undefined,
  workLoadKg: number | null,
  calibratedToday: boolean,
): WarmupSet[] {
  const share = intensityShare(intensity)
  if (implement !== LoadImplement.Barbell || share === null || share < 0.75) return []
  if (calibratedToday || workLoadKg === null) return []
  const twoThirds = Math.round((workLoadKg * 2) / 3 / 2.5) * 2.5
  const sets = [{ loadKg: EMPTY_BAR_KG, reps: 8 }]
  if (twoThirds > EMPTY_BAR_KG) sets.push({ loadKg: twoThirds, reps: 4 })
  return sets
}
