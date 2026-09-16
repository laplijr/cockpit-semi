/**
 * Structure d'une séance, commune aux trois sports. La course la remplit en
 * distances et allures, le vélo et la muscu en durées et en séries : c'est la
 * même forme qui est stockée dans `session.prescription` et lue par le cockpit.
 */
export interface PrescriptionStep {
  label: string
  repeats?: number
  distanceM?: number
  durationS?: number
  paceSecPerKm?: number
  recoveryS?: number
  /** Portion soumise au quota d'intensité (§ 8). */
  intense?: boolean
  /** Exercice de la bibliothèque muscu auquel l'étape correspond. */
  exerciseId?: string
  /** Charge tenue à la dernière séance de cet exercice, en kilogrammes. */
  loadKg?: number
  /** Répétitions d'une série de muscu. */
  reps?: number
  /** Vrai quand les répétitions sont des secondes de maintien. */
  isometric?: boolean
  /** Repère d'intensité en toutes lettres : « 85–90 % », « 56–75 % FTP ». */
  intensity?: string
  note?: string
}

export interface Prescription {
  /** Code de la bibliothèque du sport : `EF`, `Z2`, `legs`… */
  code: string
  label: string
  /** Nulle pour une séance sans kilométrage (vélo en durée, muscu). */
  totalDistanceM: number
  /** Distance de la portion intense, celle que le quota borne. */
  qualityDistanceM: number
  expectedRpe: number
  /**
   * Durée prévue de la séance, quand ses étapes ne la donnent pas : une muscu
   * se compte en séries, pas en minutes, mais elle pèse dans la charge.
   */
  durationMin?: number
  steps: PrescriptionStep[]
}

/**
 * Durée d'une prescription, déduite de ses durées explicites ou de ses
 * distances et allures. Sert de base à une conversion à charge égale (§ 5, R8).
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

export function prescribedDurationMin(prescription: Prescription): number {
  return prescription.durationMin ?? Math.round(prescribedDurationS(prescription) / 60)
}

/** Unités arbitraires d'une séance prescrite : `RPE × durée_min` (§ 5). */
export function prescribedUnits(prescription: Prescription): number {
  return prescription.expectedRpe * prescribedDurationMin(prescription)
}
