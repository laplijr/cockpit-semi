import type { Prescription, PrescriptionStep } from '../shared/prescription'
import type { StrengthExercise } from './exercises'
import { StrengthGroup, exercisesOf } from './exercises'
import type { StrengthPhase } from './phases'
import { STRENGTH_DOSES } from './phases'

export enum StrengthSessionCode {
  Legs = 'legs',
  Push = 'push',
  Pull = 'pull',
  Mobility = 'mobilite',
}

export interface StrengthSessionType {
  code: StrengthSessionCode
  label: string
  group: StrengthGroup
  /** Vrai quand la séance charge les jambes : gelée sur blessure basse (§ 5). */
  lowerBody: boolean
  expectedRpe: number
  durationMin: number
  note: string
}

export const STRENGTH_SESSION_TYPES: Record<StrengthSessionCode, StrengthSessionType> = {
  [StrengthSessionCode.Legs]: {
    code: StrengthSessionCode.Legs,
    label: 'Legs',
    group: StrengthGroup.Legs,
    lowerBody: true,
    expectedRpe: 7,
    durationMin: 60,
    note: 'Le soir d’un jour dur, course d’abord et six heures d’écart.',
  },
  [StrengthSessionCode.Push]: {
    code: StrengthSessionCode.Push,
    label: 'Push',
    group: StrengthGroup.Push,
    lowerBody: false,
    expectedRpe: 6,
    durationMin: 45,
    note: 'Haut du corps : aucune interférence avec la course du lendemain.',
  },
  [StrengthSessionCode.Pull]: {
    code: StrengthSessionCode.Pull,
    label: 'Pull',
    group: StrengthGroup.Pull,
    lowerBody: false,
    expectedRpe: 6,
    durationMin: 45,
    note: 'Dos et tronc, tenable la veille d’un seuil.',
  },
  [StrengthSessionCode.Mobility]: {
    code: StrengthSessionCode.Mobility,
    label: 'Mobilité',
    group: StrengthGroup.Mobility,
    lowerBody: false,
    expectedRpe: 2,
    durationMin: 25,
    note: 'Amplitude et pied, sans charge : la séance des semaines de récupération.',
  },
}

export function strengthSessionType(code: StrengthSessionCode): StrengthSessionType {
  return STRENGTH_SESSION_TYPES[code]
}

/** Bloc prévention de dix minutes, en fin de chaque séance chargée (§ 8). */
export const PREVENTION_BLOCK_MIN = 10

/**
 * Marche de progression d'un exercice progressif, du premier au dernier palier
 * sur la durée annoncée. Le Nordic va de 1 × 4 à 3 × 8 en six semaines (§ 5).
 */
export function progressionStep(
  exercise: StrengthExercise,
  weekInPhase: number,
): { sets: number; reps: number } {
  const { progression } = exercise
  if (!progression) return { sets: exercise.sets, reps: exercise.reps }

  const ratio = Math.min(1, Math.max(0, (weekInPhase - 1) / (progression.weeks - 1)))
  return {
    sets: Math.round(progression.fromSets + (progression.toSets - progression.fromSets) * ratio),
    reps: Math.round(progression.fromReps + (progression.toReps - progression.fromReps) * ratio),
  }
}

export interface StrengthPrescriptionContext {
  phase: StrengthPhase
  /** Rang de la semaine dans la phase, à partir de 1 : pilote les progressions. */
  weekInPhase: number
}

/** Structure concrète d'une séance de muscu, dosée par la phase (§ 5). */
export function strengthPrescription(
  code: StrengthSessionCode,
  { phase, weekInPhase }: StrengthPrescriptionContext,
): Prescription {
  const type = strengthSessionType(code)
  const dose = STRENGTH_DOSES[phase]
  const exercises = exercisesOf(type.group).filter(
    (exercise) => dose.plyometrics || exercise.id !== 'pliometrie',
  )

  /** La mobilité n'a pas d'exercice principal : aucune charge à doser. */
  const loaded = type.group !== StrengthGroup.Mobility
  const steps: PrescriptionStep[] = exercises.map((exercise, index) =>
    stepFor(exercise, loaded && index === 0, dose, weekInPhase),
  )

  if (type.group !== StrengthGroup.Mobility) {
    steps.push({
      label: 'Bloc prévention',
      durationS: PREVENTION_BLOCK_MIN * 60,
      note: 'Moyen fessier, tendon rotulien, hanche, cheville, pied.',
    })
  }

  return {
    code,
    label: type.label,
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: type.expectedRpe,
    durationMin: type.durationMin,
    steps,
  }
}

function stepFor(
  exercise: StrengthExercise,
  main: boolean,
  dose: (typeof STRENGTH_DOSES)[StrengthPhase],
  weekInPhase: number,
): PrescriptionStep {
  const progressed = progressionStep(exercise, weekInPhase)
  const sets = main ? dose.sets : Math.max(1, Math.round(progressed.sets * dose.volumeFactor + 0.4))
  const reps = main ? dose.reps : progressed.reps

  return {
    label: exercise.label,
    exerciseId: exercise.id,
    repeats: sets,
    reps,
    isometric: exercise.isometric,
    intensity: main ? dose.intensity : undefined,
    recoveryS: main ? dose.restS : undefined,
    intense: main,
    note: exercise.why,
  }
}
