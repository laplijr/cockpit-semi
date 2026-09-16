import type { Prescription, PrescriptionStep } from '../running/session-types'

/** Zone 2 sur le vélo : l'équivalent d'une endurance en course (§ 5, R8). */
export const CYCLING_CODE = 'Z2'

/**
 * Durée d'une prescription de course, déduite de ses distances et allures.
 * Sert de base à une conversion à charge égale.
 */
export function prescribedDurationS(prescription: Prescription): number {
  return prescription.steps.reduce((total, step) => {
    const repeats = step.repeats ?? 1
    if (step.durationS) return total + (step.durationS + (step.recoveryS ?? 0)) * repeats
    if (step.distanceM && step.paceSecPerKm) {
      return total + (step.distanceM / 1000) * step.paceSecPerKm * repeats
    }
    return total
  }, 0)
}

/**
 * Convertit une séance de course en séance de vélo à charge équivalente :
 * même durée, même RPE, donc mêmes unités arbitraires (§ 5, R8).
 */
export function toCyclingPrescription(prescription: Prescription): Prescription {
  const durationS = Math.round(prescribedDurationS(prescription))
  const step: PrescriptionStep = { label: 'Vélo Z2', durationS }

  return {
    code: prescription.code,
    label: 'Vélo Z2, conversion à charge égale',
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: prescription.expectedRpe,
    steps: [step],
  }
}
