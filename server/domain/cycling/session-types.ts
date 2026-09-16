import { PhaseType } from '../plan/phases'
import type { Prescription, PrescriptionStep } from '../shared/prescription'

export enum CycleSessionCode {
  EnduranceZ2 = 'Z2',
  LongRide = 'SL_velo',
  LowCadenceForce = 'force_cadence',
  SweetSpot = 'sweet_spot',
}

export interface CycleSessionType {
  code: CycleSessionCode
  label: string
  /** Bornes de durée de la séance, en minutes. */
  minDurationMin: number
  maxDurationMin: number
  /** Repère de puissance, en pourcentage de FTP. */
  ftpRange: string
  /** Repère de fréquence cardiaque, en pourcentage de FCmax. */
  hrRange: string
  expectedRpe: number
  allowedPhases: PhaseType[]
  /**
   * Une séance de secours n'est jamais posée par le générateur : elle n'arrive
   * que par conversion d'une séance de course, sur douleur (§ 5, R8).
   */
  onPainOnly: boolean
  note: string
}

export const CYCLE_SESSION_TYPES: Record<CycleSessionCode, CycleSessionType> = {
  [CycleSessionCode.EnduranceZ2]: {
    code: CycleSessionCode.EnduranceZ2,
    label: 'Endurance Z2',
    minDurationMin: 75,
    maxDurationMin: 120,
    ftpRange: '56–75 % FTP',
    hrRange: '65–75 % FCmax',
    expectedRpe: 3,
    allowedPhases: [
      PhaseType.Base,
      PhaseType.ShortBase,
      PhaseType.Development,
      PhaseType.Specific,
      PhaseType.Speed,
      PhaseType.Rebuild,
      PhaseType.Recovery,
      PhaseType.Transition,
    ],
    onPainOnly: false,
    note: 'Du volume aérobie sans impact, le lendemain d’une séance clé. Compte dans la charge, pas dans le kilométrage.',
  },
  [CycleSessionCode.LongRide]: {
    code: CycleSessionCode.LongRide,
    label: 'Sortie longue vélo',
    minDurationMin: 150,
    maxDurationMin: 180,
    ftpRange: '56–75 % FTP',
    hrRange: '65–75 % FCmax',
    expectedRpe: 4,
    allowedPhases: [PhaseType.Base, PhaseType.ShortBase, PhaseType.Development],
    onPainOnly: false,
    note: 'Une fois par mois en base et en développement, dans la semaine allégée. Coupée dès la phase spécifique.',
  },
  [CycleSessionCode.LowCadenceForce]: {
    code: CycleSessionCode.LowCadenceForce,
    label: 'Force basse cadence',
    minDurationMin: 60,
    maxDurationMin: 90,
    ftpRange: '90–100 % FTP',
    hrRange: '75–85 % FCmax',
    expectedRpe: 6,
    allowedPhases: [PhaseType.Base, PhaseType.ShortBase, PhaseType.Rebuild],
    onPainOnly: false,
    note: 'En côte, assis, gros braquet. Surtout en relance pour le dénivelé ; en base seulement à 48 h du Legs.',
  },
  [CycleSessionCode.SweetSpot]: {
    code: CycleSessionCode.SweetSpot,
    label: 'Sweet spot',
    minDurationMin: 60,
    maxDurationMin: 75,
    ftpRange: '88–93 % FTP',
    hrRange: '80–88 % FCmax',
    expectedRpe: 7,
    allowedPhases: [PhaseType.Development, PhaseType.Specific, PhaseType.Speed],
    onPainOnly: true,
    note: 'Remplace un seuil course uniquement en cas de douleur. En cas de fatigue, on ne remplace pas : on fait Z2.',
  },
}

export function cycleSessionType(code: CycleSessionCode): CycleSessionType {
  return CYCLE_SESSION_TYPES[code]
}

/** Séances que le générateur peut poser dans une phase, hors conversion. */
export function plannableCycleSessions(phase: PhaseType): CycleSessionCode[] {
  return Object.values(CYCLE_SESSION_TYPES)
    .filter((type) => !type.onPainOnly && type.allowedPhases.includes(phase))
    .map((type) => type.code)
}

/** Structure concrète d'une séance de vélo, à durée bornée par son type. */
export function cyclingPrescription(code: CycleSessionCode, durationMin?: number): Prescription {
  const type = cycleSessionType(code)
  const total = Math.round(
    Math.min(
      type.maxDurationMin,
      Math.max(type.minDurationMin, durationMin ?? type.minDurationMin),
    ),
  )

  return {
    code,
    label: type.label,
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: type.expectedRpe,
    durationMin: total,
    steps: buildSteps(code, total, type),
  }
}

function buildSteps(
  code: CycleSessionCode,
  totalMin: number,
  type: CycleSessionType,
): PrescriptionStep[] {
  const warmup: PrescriptionStep = { label: 'Échauffement progressif', durationS: 10 * 60 }
  const cooldown: PrescriptionStep = { label: 'Retour au calme souple', durationS: 8 * 60 }

  switch (code) {
    case CycleSessionCode.EnduranceZ2:
    case CycleSessionCode.LongRide:
      return [
        warmup,
        {
          label: 'Zone 2, cadence 90–95',
          durationS: (totalMin - 18) * 60,
          intensity: type.ftpRange,
        },
        cooldown,
      ]

    case CycleSessionCode.LowCadenceForce:
      return [
        warmup,
        {
          label: 'Force, 55–65 rpm assis',
          intense: true,
          repeats: 5,
          durationS: 5 * 60,
          recoveryS: 3 * 60,
          intensity: type.ftpRange,
        },
        cooldown,
      ]

    case CycleSessionCode.SweetSpot:
      return [
        warmup,
        {
          label: 'Sweet spot',
          intense: true,
          repeats: 2,
          durationS: 20 * 60,
          recoveryS: 5 * 60,
          intensity: type.ftpRange,
        },
        cooldown,
      ]
  }
}
