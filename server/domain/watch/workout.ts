import type { Prescription, PrescriptionStep } from '../shared/prescription'
import { COOLDOWN_M, RUN_SESSION_TYPES, WARMUP_M } from '../running/session-types'
import type { RunSessionCode } from '../running/session-types'

/**
 * Une séance structurée telle qu'une montre la comprend (§ 9, P6.7) : des
 * étapes typées, groupées en blocs quand elles se répètent. Rien ici ne sait
 * ce qu'est un fichier FIT — l'encodage vit dans l'infra.
 */
export enum WorkoutStepKind {
  Warmup = 'echauffement',
  Active = 'effort',
  Recovery = 'recuperation',
  Cooldown = 'retour_au_calme',
}

export interface WorkoutStep {
  kind: WorkoutStepKind
  label: string
  /** Cible de durée, en secondes ; exclusive de la distance. */
  durationS?: number
  /** Cible de distance, en mètres ; exclusive de la durée. */
  distanceM?: number
  /** Allure visée, en secondes par kilomètre. */
  paceSecPerKm?: number
  /** Effort perçu visé, quand l'allure n'a pas de sens : les côtes (§ 5, P1.5). */
  rpe?: number
}

/** Une étape, ou un groupe d'étapes répété : c'est ce que la montre affiche. */
export interface WorkoutBlock {
  repeats: number
  steps: WorkoutStep[]
}

export interface StructuredWorkout {
  /** Nom lisible sur la montre : le libellé de la séance. */
  name: string
  code: RunSessionCode
  blocks: WorkoutBlock[]
}

/** Seules les séances de la bibliothèque course se posent sur une montre. */
function runCodeOf(prescription: Prescription): RunSessionCode | undefined {
  const code = prescription.code as RunSessionCode
  return code in RUN_SESSION_TYPES ? code : undefined
}

/**
 * L'échauffement et le retour au calme sont posés par le générateur à ces
 * distances exactes, en tête et en queue de séance (§ 5). Une sortie longue
 * qui commence par quatorze kilomètres faciles n'est pas un échauffement :
 * c'est la séance elle-même.
 */
function kindOf(step: PrescriptionStep, index: number, steps: PrescriptionStep[]): WorkoutStepKind {
  if (steps.length < 2) return WorkoutStepKind.Active
  if (index === 0 && step.distanceM === WARMUP_M) return WorkoutStepKind.Warmup
  if (index === steps.length - 1 && step.distanceM === COOLDOWN_M) return WorkoutStepKind.Cooldown
  return WorkoutStepKind.Active
}

/**
 * Cible d'une étape : la durée quand elle est prescrite, la distance sinon.
 * Une étape qui porte les deux — le seuil, le test — se court en durée : c'est
 * elle qui a été décidée, la distance n'en est que la conséquence.
 */
function targetOf(step: PrescriptionStep): Pick<WorkoutStep, 'durationS' | 'distanceM'> {
  if (step.durationS !== undefined) return { durationS: step.durationS }
  if (step.distanceM !== undefined) return { distanceM: step.distanceM }
  return {}
}

function effortStep(
  step: PrescriptionStep,
  kind: WorkoutStepKind,
  expectedRpe: number,
): WorkoutStep {
  return {
    kind,
    label: step.label,
    ...targetOf(step),
    /** Sans allure prescrite — les côtes —, la cible est l'effort (§ 5, P1.5). */
    ...(step.paceSecPerKm === undefined
      ? { rpe: expectedRpe }
      : { paceSecPerKm: step.paceSecPerKm }),
  }
}

function recoveryStep(recoveryS: number): WorkoutStep {
  return { kind: WorkoutStepKind.Recovery, label: 'Récupération', durationS: recoveryS }
}

function blockOf(
  step: PrescriptionStep,
  index: number,
  steps: PrescriptionStep[],
  expectedRpe: number,
): WorkoutBlock {
  const effort = effortStep(step, kindOf(step, index, steps), expectedRpe)
  const repeats = step.repeats ?? 1

  if (repeats <= 1 && step.recoveryS === undefined) return { repeats: 1, steps: [effort] }

  return {
    repeats,
    steps: step.recoveryS === undefined ? [effort] : [effort, recoveryStep(step.recoveryS)],
  }
}

/**
 * Traduit une prescription en séance structurée. Une séance qui n'est pas de
 * la course — vélo, renforcement — ne donne rien : la montre n'a pas de
 * séance à recevoir, et ce n'est pas une erreur (§ 9, P6.7).
 */
export function structuredWorkout(prescription: Prescription): StructuredWorkout | undefined {
  const code = runCodeOf(prescription)
  if (code === undefined) return undefined

  const steps = prescription.steps
  if (steps.length === 0) return undefined

  return {
    name: prescription.label,
    code,
    blocks: steps.map((step, index) => blockOf(step, index, steps, prescription.expectedRpe)),
  }
}
