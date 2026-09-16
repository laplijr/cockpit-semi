import { PhaseType } from '../plan/phases'

/** Phases de la musculation, calées sur celles du plan course (§ 5). */
export enum StrengthPhase {
  Adaptation = 'adaptation',
  Force = 'force',
  ForcePower = 'force_puissance',
  Maintenance = 'entretien',
  Light = 'legere',
  Mobility = 'mobilite',
  Off = 'arret',
}

export const STRENGTH_PHASE_LABELS: Record<StrengthPhase, string> = {
  [StrengthPhase.Adaptation]: 'Adaptation',
  [StrengthPhase.Force]: 'Force',
  [StrengthPhase.ForcePower]: 'Force-puissance',
  [StrengthPhase.Maintenance]: 'Entretien',
  [StrengthPhase.Light]: 'Légère',
  [StrengthPhase.Mobility]: 'Mobilité',
  [StrengthPhase.Off]: 'Arrêt',
}

export interface StrengthDose {
  /** Séries et répétitions de l'exercice principal. */
  sets: number
  reps: number
  /** Repère de charge, en pourcentage de la répétition maximale. */
  intensity: string
  /** Facteur appliqué au volume des exercices secondaires. */
  volumeFactor: number
  /** La pliométrie n'entre qu'en force-puissance (§ 5). */
  plyometrics: boolean
  /** Module le repos que la nature de l'effort fixe, sans le remplacer (§ 5). */
  restFactor: number
  /**
   * Décalage de l'effort perçu de la séance. Un Legs d'affûtage et un Legs de
   * force-puissance ne pèsent pas pareil dans la charge, mais un Push ne pèse
   * pas non plus comme un Legs : la phase décale, elle ne remplace pas (§ 5).
   */
  rpeShift: number
  /** Vrai quand l'exercice principal est dosé à 85 % ou plus (§ 5, G1). */
  heavyMainLift: boolean
}

export const STRENGTH_DOSES: Record<StrengthPhase, StrengthDose> = {
  [StrengthPhase.Adaptation]: {
    sets: 3,
    reps: 9,
    intensity: '70 %',
    volumeFactor: 1,
    plyometrics: false,
    restFactor: 1,
    rpeShift: -1,
    heavyMainLift: false,
  },
  [StrengthPhase.Force]: {
    sets: 4,
    reps: 5,
    intensity: '85 %',
    volumeFactor: 1,
    plyometrics: false,
    restFactor: 1,
    rpeShift: 0,
    heavyMainLift: true,
  },
  [StrengthPhase.ForcePower]: {
    sets: 4,
    reps: 4,
    intensity: '≥ 85 %',
    volumeFactor: 1,
    plyometrics: true,
    restFactor: 1,
    rpeShift: 1,
    heavyMainLift: true,
  },
  [StrengthPhase.Maintenance]: {
    sets: 3,
    reps: 5,
    intensity: '85 %',
    volumeFactor: 0.7,
    plyometrics: false,
    restFactor: 0.9,
    rpeShift: -1,
    heavyMainLift: true,
  },
  [StrengthPhase.Light]: {
    sets: 2,
    reps: 3,
    intensity: '85 %',
    volumeFactor: 0.5,
    plyometrics: false,
    restFactor: 0.8,
    rpeShift: -3,
    heavyMainLift: false,
  },
  [StrengthPhase.Mobility]: {
    sets: 2,
    reps: 12,
    intensity: 'à vide',
    volumeFactor: 0.5,
    plyometrics: false,
    restFactor: 0.7,
    rpeShift: 0,
    heavyMainLift: false,
  },
  [StrengthPhase.Off]: {
    sets: 0,
    reps: 0,
    intensity: '—',
    volumeFactor: 0,
    plyometrics: false,
    restFactor: 0,
    rpeShift: 0,
    heavyMainLift: false,
  },
}

/** Semaines d'adaptation au début d'une base, avant de passer en force (§ 5). */
export const ADAPTATION_WEEKS = 3

/**
 * Phase muscu d'une semaine : la base commence en adaptation puis passe en
 * force, le développement et la vitesse travaillent la force-puissance, le
 * spécifique entretient, l'affûtage s'allège et la récup passe en mobilité.
 */
export function strengthPhaseFor(phase: PhaseType, weekInPhase: number): StrengthPhase {
  switch (phase) {
    case PhaseType.Base:
    case PhaseType.ShortBase:
      return weekInPhase <= ADAPTATION_WEEKS ? StrengthPhase.Adaptation : StrengthPhase.Force
    case PhaseType.Development:
    case PhaseType.Speed:
      return StrengthPhase.ForcePower
    case PhaseType.Specific:
    case PhaseType.Rebuild:
      return StrengthPhase.Maintenance
    case PhaseType.Taper:
      return StrengthPhase.Light
    case PhaseType.Recovery:
      return StrengthPhase.Mobility
    case PhaseType.Transition:
      return StrengthPhase.Off
  }
}
