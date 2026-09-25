import type { Prescription, PrescriptionStep } from '../shared/prescription'

/** Marge d'une portion intense : 3 %, une dizaine de secondes au kilomètre à 6:00. */
export const INTENSE_PACE_MARGIN = 0.03
/**
 * Marge d'une portion facile : la borne lente de la zone E, 14 % au-dessus de
 * l'allure affichée (8:05 pour 7:05 au VDOT 33). Courir plus lentement qu'une
 * endurance n'est pas la manquer.
 */
export const EASY_PACE_MARGIN = 0.14

export interface HeldPaceInput {
  prescription: Prescription
  actualDistanceM: number | null
  actualDurationMin: number | null
  rpe: number | null
}

interface Allowance {
  seconds: number
  meters: number
}

/**
 * Le temps et la distance qu'une étape autorise à son allure la plus lente.
 * Une récupération compte en temps et pas en distance : trottée, elle rend
 * le réalisé plus rapide, donc la comparaison plus clémente, jamais plus dure.
 */
function stepAllowance(step: PrescriptionStep): Allowance | undefined {
  if (!step.paceSecPerKm) return undefined
  const repeats = step.repeats ?? 1
  const slowestPace =
    step.paceSecPerKm * (1 + (step.intense ? INTENSE_PACE_MARGIN : EASY_PACE_MARGIN))
  const recovery = step.recoveryS ?? 0

  if (step.distanceM) {
    return {
      seconds: repeats * ((step.distanceM / 1000) * slowestPace + recovery),
      meters: repeats * step.distanceM,
    }
  }
  if (step.durationS) {
    return {
      seconds: repeats * (step.durationS + recovery),
      meters: repeats * ((step.durationS / slowestPace) * 1000),
    }
  }
  return undefined
}

/** L'allure moyenne la plus lente que la séance entière autorise, en s/km. */
function slowestSessionPace(prescription: Prescription): number | undefined {
  const allowances = prescription.steps.map(stepAllowance)
  if (allowances.length === 0 || allowances.some((item) => item === undefined)) return undefined

  const total = (allowances as Allowance[]).reduce(
    (sum, item) => ({ seconds: sum.seconds + item.seconds, meters: sum.meters + item.meters }),
    { seconds: 0, meters: 0 },
  )
  return total.meters === 0 ? undefined : total.seconds / (total.meters / 1000)
}

/**
 * L'allure tenue se juge séance entière contre séance entière : l'allure
 * moyenne réalisée contre la plus lente que la prescription autorise,
 * échauffement et récupérations compris des deux côtés — une allure de
 * fraction comparée à une moyenne qui porte l'échauffement serait fausse.
 * Sans réalisé chiffré, ou pour une séance sans allure, le RPE dans la cible
 * reste le repli (§ 5, R7).
 */
export function isPaceHeld(input: HeldPaceInput): boolean {
  const slowest = slowestSessionPace(input.prescription)
  const { actualDistanceM, actualDurationMin } = input

  if (slowest !== undefined && actualDistanceM && actualDurationMin) {
    return (actualDurationMin * 60) / (actualDistanceM / 1000) <= slowest
  }
  return input.rpe === null || input.rpe <= input.prescription.expectedRpe
}
