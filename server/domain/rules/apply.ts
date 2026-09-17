import type { Prescription } from '../running/session-types'
import { ProposalEffect } from './rules'

/** Facteurs de réduction portés par les règles R2 (§ 5). */
export const EASY_REDUCTION = 0.7
export const LONG_RUN_REDUCTION = 0.9

/** Effets qui se traduisent directement en une nouvelle prescription. */
const SESSION_EFFECTS: ProposalEffect[] = [
  ProposalEffect.ReduceEasyVolume,
  ProposalEffect.ReduceLongRun,
  ProposalEffect.ReduceRepeats,
  ProposalEffect.ReduceStrengthSet,
  ProposalEffect.AdjustExpectedRpe,
]

export function isSessionEffect(effect: ProposalEffect): boolean {
  return SESSION_EFFECTS.includes(effect)
}

function scale(prescription: Prescription, factor: number): Prescription {
  const steps = prescription.steps.map((step) => ({
    ...step,
    distanceM: step.distanceM === undefined ? undefined : Math.round(step.distanceM * factor),
  }))

  return {
    ...prescription,
    steps,
    totalDistanceM: Math.round(prescription.totalDistanceM * factor),
    qualityDistanceM: Math.round(prescription.qualityDistanceM * factor),
  }
}

function dropOneRepeat(prescription: Prescription): Prescription {
  const steps = prescription.steps.map((step) =>
    step.intense && (step.repeats ?? 0) > 1 ? { ...step, repeats: step.repeats! - 1 } : step,
  )

  const measure = (list: typeof steps, intenseOnly: boolean) =>
    list
      .filter((step) => !intenseOnly || step.intense)
      .reduce((total, step) => total + (step.distanceM ?? 0) * (step.repeats ?? 1), 0)

  return {
    ...prescription,
    steps,
    totalDistanceM: Math.round(measure(steps, false)),
    qualityDistanceM: Math.round(measure(steps, true)),
  }
}

/**
 * Applique l'effet d'une proposition acceptée à une prescription.
 * Les effets de plan (gel, pause, conversion) ne passent pas par ici.
 */
export function applyToPrescription(
  prescription: Prescription,
  effect: ProposalEffect,
  payload?: Record<string, unknown> | null,
): Prescription {
  switch (effect) {
    case ProposalEffect.ReduceEasyVolume:
      return scale(prescription, EASY_REDUCTION)
    case ProposalEffect.ReduceLongRun:
      return scale(prescription, LONG_RUN_REDUCTION)
    case ProposalEffect.ReduceRepeats:
    case ProposalEffect.ReduceStrengthSet:
      return dropOneRepeat(prescription)
    case ProposalEffect.AdjustExpectedRpe:
      return withExpectedRpe(prescription, payload)
    default:
      return prescription
  }
}

/** Le RPE recalé voyage dans le `payload` : le texte d'une proposition ne le porte pas. */
function withExpectedRpe(
  prescription: Prescription,
  payload: Record<string, unknown> | null | undefined,
): Prescription {
  const value = Number(payload?.expectedRpe)
  if (!Number.isFinite(value)) return prescription
  return { ...prescription, expectedRpe: Math.min(10, Math.max(1, value)) }
}
