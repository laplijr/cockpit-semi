import { RunSessionCode } from '../running/session-types'
import type { Prescription } from '../shared/prescription'
import { prescribedDurationMin } from '../shared/prescription'
import { CycleSessionCode, cycleSessionType } from './session-types'

/**
 * Séance de vélo qui remplace une séance de course : le sweet spot conserve le
 * stimulus d'un seuil, tout le reste devient du Z2 (§ 5, R8).
 */
export function cyclingCodeFor(code: string): CycleSessionCode {
  return code === RunSessionCode.Threshold
    ? CycleSessionCode.SweetSpot
    : CycleSessionCode.EnduranceZ2
}

/**
 * Convertit une séance de course en séance de vélo à charge égale : ce sont les
 * unités arbitraires qui se conservent, pas la durée. Une endurance de 50′ à
 * RPE 4 devient donc un Z2 plus long, roulé moins intensément (§ 5, R8). Les
 * bornes de durée du type ne s'appliquent pas : c'est la charge qui commande.
 */
export function toCyclingPrescription(prescription: Prescription): Prescription {
  const code = cyclingCodeFor(prescription.code)
  const type = cycleSessionType(code)
  const units = prescription.expectedRpe * prescribedDurationMin(prescription)
  const durationMin = Math.round(units / type.expectedRpe)

  return {
    code,
    label: `${type.label}, conversion à charge égale`,
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: type.expectedRpe,
    durationMin,
    steps: [{ label: type.label, durationS: durationMin * 60, intensity: type.ftpRange }],
  }
}
