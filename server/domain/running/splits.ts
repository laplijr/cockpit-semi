import type { Prescription } from '../shared/prescription'

/** Ces calculs ne lisent que la structure : le cockpit n'a que celle-là sous la main. */
type StepsOf = Pick<Prescription, 'steps'>

/**
 * Ce qui a été tenu sur une portion de la structure : une étape, ou une
 * répétition d'étape. La récupération entre deux fractions n'en est pas une :
 * elle se trottine à la sensation, et le total de la séance la compte déjà.
 */
export interface StepSplit {
  /** Rang de l'étape dans la prescription. */
  step: number
  /** Rang de la répétition dans l'étape, à partir de zéro. */
  rep: number
  distanceM: number
  durationS: number
}

/** Une portion à chronométrer, telle que le retour de séance la propose. */
export interface SplitSlot {
  step: number
  rep: number
  label: string
  repeats: number
  distanceM?: number
  durationS?: number
  paceSecPerKm?: number
}

/** Chaque étape, répétitions dépliées : une montre donne un tour par fraction. */
export function splitSlots(prescription: StepsOf): SplitSlot[] {
  return prescription.steps.flatMap((step, index) => {
    const repeats = step.repeats ?? 1
    return Array.from({ length: repeats }, (_, rep) => ({
      step: index,
      rep,
      label: step.label,
      repeats,
      distanceM: step.distanceM,
      durationS: step.durationS,
      paceSecPerKm: step.paceSecPerKm,
    }))
  })
}

export function isSlotOf(prescription: StepsOf, split: StepSplit): boolean {
  const step = prescription.steps[split.step]
  return step !== undefined && split.rep < (step.repeats ?? 1)
}

/**
 * L'étape qui donne le ton de la séance : celle des fractions quand il y en a,
 * sinon la plus longue. La plus longue seule faisait lire l'allure de
 * l'échauffement en tête d'une VMA (P19).
 */
export function keyStepIndex(prescription: StepsOf): number | undefined {
  const paced = prescription.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.paceSecPerKm)
  const intense = paced.filter(({ step }) => step.intense)
  const ranked = (intense.length > 0 ? intense : paced).sort(
    (a, b) =>
      (b.step.distanceM ?? b.step.durationS ?? 0) - (a.step.distanceM ?? a.step.durationS ?? 0),
  )
  return ranked[0]?.index
}

/** Allure des portions chronométrées, en s/km ; nulle sans mesure. */
export function splitsPace(splits: StepSplit[]): number | null {
  const meters = splits.reduce((sum, split) => sum + split.distanceM, 0)
  const seconds = splits.reduce((sum, split) => sum + split.durationS, 0)
  return meters > 0 ? seconds / (meters / 1000) : null
}

/**
 * L'allure tenue sur l'étape clé, quand elle a été chronométrée : c'est elle
 * qui se compare à l'allure visée. La moyenne de la séance porte
 * l'échauffement ou les premiers tiers, et ne se compare à rien de prescrit.
 */
export function keyStepPace(prescription: StepsOf, splits: StepSplit[]): number | null {
  const key = keyStepIndex(prescription)
  if (key === undefined) return null
  return splitsPace(splits.filter((split) => split.step === key))
}

/** Plusieurs allures dans la même séance : sa moyenne n'est celle d'aucune étape. */
export function hasSeveralPaces(prescription: StepsOf): boolean {
  const paces = prescription.steps.flatMap((step) => step.paceSecPerKm ?? [])
  return new Set(paces).size > 1
}

/**
 * L'allure moyenne que la prescription demande, pondérée par la distance de
 * chaque étape, récupérations exclues : le pendant prescrit d'une allure
 * moyenne réalisée.
 */
export function averagePrescribedPace(prescription: StepsOf): number | null {
  const paced = prescription.steps.filter((step) => step.distanceM && step.paceSecPerKm)
  const meters = paced.reduce((sum, step) => sum + step.distanceM! * (step.repeats ?? 1), 0)
  const seconds = paced.reduce(
    (sum, step) => sum + (step.distanceM! / 1000) * step.paceSecPerKm! * (step.repeats ?? 1),
    0,
  )
  return meters > 0 ? seconds / (meters / 1000) : null
}
