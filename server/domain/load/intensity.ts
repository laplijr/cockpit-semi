import { TrainingZone, oxygenCost } from '../fitness/vdot'
import type { Prescription, PrescriptionStep } from '../shared/prescription'

/**
 * La part du temps de course dans chaque zone de Daniels (P22). Les deux
 * quotas du moteur ne bornent chacun qu'une zone — I ≤ 8 %, T ≤ 10 % (§ 8) :
 * l'allure semi a le sien (20 %), les lignes droites et les côtes aussi. Les
 * regrouper en trois étages aurait comparé M + T au seul quota de T.
 */
export type IntensityShares = Record<TrainingZone, number>

export const INTENSITY_QUOTAS = {
  [TrainingZone.Threshold]: 0.1,
  [TrainingZone.Interval]: 0.08,
} as const

const EMPTY: IntensityShares = {
  [TrainingZone.Easy]: 0,
  [TrainingZone.Marathon]: 0,
  [TrainingZone.Threshold]: 0,
  [TrainingZone.Interval]: 0,
  [TrainingZone.Repetition]: 0,
}

/**
 * Bornes hautes de %VDOT, sur les plages du § 5 (E 59–74, M 75–84, T 83–88,
 * I 95–100, R 105–110). Là où deux plages se chevauchent, la plus lente gagne ;
 * entre deux plages, la frontière est au milieu. L'allure semi d'un coureur à
 * VDOT 34 tombe à 84 % : c'est de l'allure, pas du seuil, alors que l'allure T
 * affichée est plus proche d'elle que l'allure M.
 */
const ZONE_CEILINGS: [TrainingZone, number][] = [
  [TrainingZone.Easy, 0.745],
  [TrainingZone.Marathon, 0.84],
  [TrainingZone.Threshold, 0.915],
  [TrainingZone.Interval, 1.025],
]

function zoneOf(paceSecPerKm: number, vdot: number): TrainingZone {
  const share = oxygenCost(60_000 / paceSecPerKm) / vdot
  return ZONE_CEILINGS.find(([, ceiling]) => share <= ceiling)?.[0] ?? TrainingZone.Repetition
}

function stepSeconds(step: PrescriptionStep): number {
  if (step.durationS) return step.durationS
  if (step.distanceM && step.paceSecPerKm) return (step.distanceM / 1000) * step.paceSecPerKm
  return 0
}

/**
 * Le temps de chaque zone dans une séance prescrite. Une récupération se
 * trottine : elle compte en endurance. Une portion intense sans allure — les
 * côtes — se court à l'effort, sur des répétitions courtes : elle compte en R.
 */
export function sessionZoneSeconds(prescription: Prescription, vdot: number): IntensityShares {
  const seconds = { ...EMPTY }

  for (const step of prescription.steps) {
    const repeats = step.repeats ?? 1
    seconds[TrainingZone.Easy] += (step.recoveryS ?? 0) * repeats

    const zone = step.paceSecPerKm
      ? zoneOf(step.paceSecPerKm, vdot)
      : step.intense
        ? TrainingZone.Repetition
        : TrainingZone.Easy
    seconds[zone] += stepSeconds(step) * repeats
  }

  return seconds
}

export interface DoneRun {
  prescription: Prescription
  /** VDOT du jour de la séance : ce sont ses zones qui classent les allures. */
  vdot: number
  /** Durée réelle ; nulle, c'est la durée prescrite qui compte. */
  actualDurationS: number | null
}

/**
 * La répartition d'une semaine de séances faites. Le réalisé n'a pas de tours,
 * seulement des totaux : on lit le prescrit de chaque séance, recalé sur sa
 * durée réelle. Une séance faite à une autre allure que prévue n'y change rien.
 */
export function weeklyIntensity(runs: readonly DoneRun[]): IntensityShares | null {
  const totals = { ...EMPTY }

  for (const run of runs) {
    const seconds = sessionZoneSeconds(run.prescription, run.vdot)
    const prescribed = Object.values(seconds).reduce((total, value) => total + value, 0)
    if (prescribed === 0) continue
    const scale = (run.actualDurationS ?? prescribed) / prescribed
    for (const zone of Object.values(TrainingZone)) totals[zone] += seconds[zone] * scale
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
  if (total === 0) return null
  return Object.fromEntries(
    Object.values(TrainingZone).map((zone) => [zone, totals[zone] / total]),
  ) as IntensityShares
}
