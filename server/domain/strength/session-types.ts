import type { Prescription, PrescriptionStep } from '../shared/prescription'
import type { StrengthExercise } from './exercises'
import { StrengthEffort, recoveryFor, strengthExercise } from './exercises'
import type { StrengthPhase } from './phases'
import { STRENGTH_DOSES } from './phases'

export enum StrengthSessionCode {
  Legs = 'legs',
  Push = 'push',
  Pull = 'pull',
  Mobility = 'mobilite',
  Power = 'puissance',
  Comeback = 'reprise',
  Cycling = 'velo',
  Full = 'full',
}

export interface StrengthSessionType {
  code: StrengthSessionCode
  label: string
  /** Vrai quand la séance charge les jambes : gelée sur blessure basse (§ 5, G5). */
  lowerBody: boolean
  /** Ordre explicite des exercices : l'ordre du fichier ne décide rien (§ 5). */
  exerciseIds: string[]
  /** Posés en tête de séance quand la phase active la pliométrie (§ 5). */
  plyometricIds: string[]
  /** Bloc prévention, en rotation selon la séance (§ 5). */
  preventionIds: string[]
  /** Effort perçu de la séance en phase de force : la phase le décale (§ 5). */
  baseRpe: number
  /** Minutes d'échauffement en tête de séance. */
  warmupMin: number
  /** Écart minimal avec la course du même jour : course d'abord (§ 5, G2). */
  minGapAfterRunS: number
  note: string
}

/** Course d'abord, six heures d'écart le même jour (§ 5, G2). */
const SAME_DAY_GAP_S = 6 * 3600

const AFTER_LEGS = ['squat-espagnol', 'monster-walk', 'short-foot']
const AFTER_PUSH = ['planche-laterale', 'monster-walk', 'genou-au-mur']
const AFTER_PULL = ['squat-espagnol', 'fente-basse', 'copenhagen']

export const STRENGTH_SESSION_TYPES: Record<StrengthSessionCode, StrengthSessionType> = {
  [StrengthSessionCode.Legs]: {
    code: StrengthSessionCode.Legs,
    label: 'Legs',
    lowerBody: true,
    plyometricIds: ['pliometrie'],
    exerciseIds: [
      'squat',
      'sdt-roumain',
      'fente-bulgare',
      'mollet-unipodal',
      'mollet-soleaire',
      'nordic',
    ],
    preventionIds: AFTER_LEGS,
    baseRpe: 7,
    warmupMin: 8,
    minGapAfterRunS: SAME_DAY_GAP_S,
    note: 'Le soir d’un jour dur, course d’abord et six heures d’écart.',
  },
  [StrengthSessionCode.Push]: {
    code: StrengthSessionCode.Push,
    label: 'Push',
    lowerBody: false,
    plyometricIds: [],
    exerciseIds: ['developpe-couche', 'developpe-militaire', 'pallof', 'dips'],
    preventionIds: AFTER_PUSH,
    baseRpe: 6,
    warmupMin: 6,
    minGapAfterRunS: 0,
    note: 'Haut du corps : aucune interférence avec la course du lendemain.',
  },
  [StrengthSessionCode.Pull]: {
    code: StrengthSessionCode.Pull,
    label: 'Pull',
    lowerBody: false,
    plyometricIds: [],
    exerciseIds: ['tractions', 'rowing', 'planche-laterale', 'face-pull', 'farmer-walk'],
    preventionIds: AFTER_PULL,
    baseRpe: 6,
    warmupMin: 6,
    minGapAfterRunS: 0,
    note: 'Dos et tronc, sans jambes : tenable la veille d’un seuil.',
  },
  [StrengthSessionCode.Mobility]: {
    code: StrengthSessionCode.Mobility,
    label: 'Mobilité',
    lowerBody: false,
    plyometricIds: [],
    exerciseIds: [
      'genou-au-mur',
      'fente-basse',
      'etirement-psoas',
      'mobilite-thoracique',
      'short-foot',
      'copenhagen',
      'respiration',
    ],
    preventionIds: [],
    baseRpe: 2,
    warmupMin: 0,
    minGapAfterRunS: 0,
    note: 'Amplitude et pied, sans charge : la séance des semaines de récupération.',
  },
  [StrengthSessionCode.Power]: {
    code: StrengthSessionCode.Power,
    label: 'Puissance',
    lowerBody: true,
    plyometricIds: ['pliometrie', 'saut-unipodal'],
    exerciseIds: ['squat'],
    preventionIds: [],
    baseRpe: 7,
    warmupMin: 10,
    minGapAfterRunS: SAME_DAY_GAP_S,
    note: 'Remplace Legs en phase vitesse : à faire frais, jamais après une course, pour que la pliométrie ne finisse pas enterrée.',
  },
  [StrengthSessionCode.Comeback]: {
    code: StrengthSessionCode.Comeback,
    label: 'Reprise',
    lowerBody: true,
    plyometricIds: [],
    exerciseIds: [
      'squat-espagnol',
      'goblet-squat',
      'pont-fessier',
      'mollet-bipodal',
      'monster-walk',
      'genou-au-mur',
    ],
    preventionIds: [],
    baseRpe: 4,
    warmupMin: 0,
    minGapAfterRunS: 0,
    note: 'Aucun excentrique lourd, aucune pliométrie : la séance d’une pause qui interdit les jambes en charge.',
  },
  [StrengthSessionCode.Cycling]: {
    code: StrengthSessionCode.Cycling,
    label: 'Vélo',
    lowerBody: true,
    plyometricIds: [],
    exerciseIds: [
      'hip-thrust',
      'fente-bulgare',
      'mollet-unipodal',
      'face-pull',
      'planche-laterale',
    ],
    preventionIds: [],
    baseRpe: 6,
    warmupMin: 6,
    minGapAfterRunS: SAME_DAY_GAP_S,
    note: 'Le grand fessier est le moteur de la poussée assise ; la fente longue travaille l’endurance de force du pédalage en côte.',
  },
  [StrengthSessionCode.Full]: {
    code: StrengthSessionCode.Full,
    label: 'Full',
    lowerBody: true,
    plyometricIds: [],
    exerciseIds: ['goblet-squat', 'tractions', 'pallof', 'sdt-roumain', 'mollet-soleaire'],
    preventionIds: ['monster-walk'],
    baseRpe: 5,
    warmupMin: 0,
    minGapAfterRunS: SAME_DAY_GAP_S,
    note: 'Dose minimale d’une semaine au pic, d’une séance rattrapée, et séance unique de l’affûtage.',
  },
}

export function strengthSessionType(code: StrengthSessionCode): StrengthSessionType {
  return STRENGTH_SESSION_TYPES[code]
}

/** Secondes d'installation comptées pour chaque exercice (§ 5). */
export const SETUP_S = 60

/** Le bloc prévention tient en dix minutes, quoi qu'il contienne (§ 5). */
export const PREVENTION_BLOCK_S = 10 * 60
/** Sous ce repos, une série n'en est plus une : le bloc déborde plutôt. */
export const MIN_RECOVERY_S = 20

/**
 * Marche de progression d'un exercice progressif. Le compteur est **cumulé
 * depuis le début de la rampe**, pas remis à zéro au changement de phase :
 * sinon le Nordic n'atteint jamais 3 × 8 (§ 5).
 */
export function progressionStep(
  exercise: StrengthExercise,
  progressionWeek: number,
): { sets: number; reps: number } {
  const { progression } = exercise
  if (!progression) return { sets: exercise.sets, reps: exercise.reps }

  const ratio = Math.min(1, Math.max(0, (progressionWeek - 1) / (progression.weeks - 1)))
  return {
    sets: Math.round(progression.fromSets + (progression.toSets - progression.fromSets) * ratio),
    reps: Math.round(progression.fromReps + (progression.toReps - progression.fromReps) * ratio),
  }
}

export interface StrengthPrescriptionContext {
  phase: StrengthPhase
  /** Semaines écoulées depuis le début de la rampe de progression (§ 5). */
  progressionWeek: number
  /** Exercices retirés : blessure basse, excentrique proscrit, volume de course. */
  excludedIds?: string[]
}

/**
 * Durée d'une étape chargée. Le repos de la dernière série n'est pas compté :
 * on enchaîne sur l'installation de l'exercice suivant, pas sur une pause.
 */
export function stepDurationS(step: PrescriptionStep): number {
  if (step.exerciseId === undefined) return step.durationS ?? 0

  const sets = step.repeats ?? 1
  const work = (step.reps ?? 0) * (step.repDurationS ?? 2) * (step.unilateral ? 2 : 1)
  return sets * work + (sets - 1) * (step.recoveryS ?? 0) + SETUP_S
}

/** Durée réelle d'une séance, déduite de ses étapes (§ 5). */
export function estimatedDurationS(steps: PrescriptionStep[]): number {
  return steps.reduce((total, step) => total + stepDurationS(step), 0)
}

/** Structure concrète d'une séance de muscu : ordre explicite, dose de phase (§ 5). */
export function strengthPrescription(
  code: StrengthSessionCode,
  { phase, progressionWeek, excludedIds = [] }: StrengthPrescriptionContext,
): Prescription {
  const type = strengthSessionType(code)
  const dose = STRENGTH_DOSES[phase]
  const excluded = new Set(excludedIds)

  const pick = (ids: string[]) =>
    ids
      .filter((id) => !excluded.has(id))
      .map(strengthExercise)
      .filter((exercise): exercise is StrengthExercise => exercise !== undefined)

  const plyometrics = dose.plyometrics ? pick(type.plyometricIds) : []
  const main = pick(type.exerciseIds)
  const prevention = pick(type.preventionIds)

  const steps: PrescriptionStep[] = []
  if (type.warmupMin > 0) {
    steps.push({ label: 'Échauffement et mobilité', durationS: type.warmupMin * 60 })
  }

  /** La pliométrie passe en tête, à froid : c'est là qu'elle vaut quelque chose. */
  for (const exercise of plyometrics) steps.push(stepFor(exercise, false, dose, progressionWeek))
  for (const [index, exercise] of main.entries()) {
    steps.push(stepFor(exercise, index === 0 && plyometrics.length === 0, dose, progressionWeek))
  }

  /** Le bloc prévention est fait d'étapes réelles, mais il tient en dix minutes. */
  steps.push(
    ...fitInPreventionBlock(
      prevention.map((exercise) => stepFor(exercise, false, dose, progressionWeek)),
    ),
  )

  return {
    code,
    label: type.label,
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: Math.min(10, Math.max(1, type.baseRpe + dose.rpeShift)),
    durationMin: Math.round(estimatedDurationS(steps) / 60),
    steps,
  }
}

/**
 * Ramène le bloc prévention dans ses dix minutes en rognant les repos, jamais
 * le travail : c'est le repos qui est négociable sur des exercices légers.
 */
function fitInPreventionBlock(steps: PrescriptionStep[]): PrescriptionStep[] {
  const total = steps.reduce((sum, step) => sum + stepDurationS(step), 0)
  if (total <= PREVENTION_BLOCK_S || steps.length === 0) return steps

  const work = steps.reduce((sum, step) => sum + stepDurationS({ ...step, recoveryS: 0 }), 0)
  const room = Math.max(0, PREVENTION_BLOCK_S - work)
  const rest = steps.reduce(
    (sum, step) => sum + ((step.repeats ?? 1) - 1) * (step.recoveryS ?? 0),
    0,
  )
  const factor = rest === 0 ? 0 : Math.min(1, room / rest)

  return steps.map((step) => ({
    ...step,
    recoveryS: Math.max(MIN_RECOVERY_S, Math.round((step.recoveryS ?? 0) * factor)),
  }))
}

function stepFor(
  exercise: StrengthExercise,
  main: boolean,
  dose: (typeof STRENGTH_DOSES)[StrengthPhase],
  progressionWeek: number,
): PrescriptionStep {
  const progressed = progressionStep(exercise, progressionWeek)
  const accessory = Math.max(1, Math.round(progressed.sets * dose.volumeFactor + 0.4))

  return {
    label: exercise.label,
    exerciseId: exercise.id,
    repeats: main ? dose.sets : accessory,
    reps: main ? dose.reps : progressed.reps,
    isometric: exercise.isometric,
    unilateral: exercise.unilateral,
    tempo: exercise.tempo,
    repDurationS: exercise.repDurationS,
    /** Chaque étape porte son repos, l'exercice principal comme les accessoires (§ 5). */
    recoveryS: recoveryFor(exercise, dose.restFactor),
    intensity: main ? dose.intensity : exercise.defaultIntensity,
    superset: exercise.superset,
    intense: main || exercise.effort === StrengthEffort.SpeedStrength,
    note: exercise.why,
  }
}
