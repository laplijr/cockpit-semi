import { describe, expect, it } from 'vitest'
import { RunSessionCode, prescription } from '~~/server/domain/running/session-types'
import { StrengthPhase } from '~~/server/domain/strength/phases'
import { StrengthSessionCode, strengthPrescription } from '~~/server/domain/strength/session-types'
import {
  WorkoutStepKind,
  structuredWorkout,
  type WorkoutBlock,
} from '~~/server/domain/watch/workout'

const CONTEXT = { vdot: 34, weeklyVolumeM: 45_000, phaseProgress: 0.5 }

function workoutOf(code: RunSessionCode, overrides = {}) {
  return structuredWorkout(prescription(code, { ...CONTEXT, ...overrides }))!
}

const kindsOf = (blocks: WorkoutBlock[]) => blocks.flatMap((b) => b.steps.map((s) => s.kind))

describe('séance structurée pour la montre (§ 9, P6.7)', () => {
  it('encadre une séance de seuil d’un échauffement et d’un retour au calme', () => {
    const workout = workoutOf(RunSessionCode.Threshold)

    expect(kindsOf(workout.blocks).at(0)).toBe(WorkoutStepKind.Warmup)
    expect(kindsOf(workout.blocks).at(-1)).toBe(WorkoutStepKind.Cooldown)
  })

  it('groupe les répétitions du seuil en un bloc avec sa récupération', () => {
    const workout = workoutOf(RunSessionCode.Threshold)
    const repeated = workout.blocks.find((block) => block.repeats > 1)!

    expect(repeated.steps.map((step) => step.kind)).toEqual([
      WorkoutStepKind.Active,
      WorkoutStepKind.Recovery,
    ])
    expect(repeated.steps[0]!.durationS).toBeGreaterThan(0)
    expect(repeated.steps[1]!.durationS).toBe(120)
  })

  it('prescrit les côtes à l’effort, jamais à l’allure', () => {
    const workout = workoutOf(RunSessionCode.Hills)
    const hills = workout.blocks.find((block) => block.repeats > 1)!.steps[0]!

    expect(hills.paceSecPerKm).toBeUndefined()
    expect(hills.rpe).toBeGreaterThan(0)
    expect(hills.durationS).toBe(30)
  })

  it('ne prend pas les quatorze premiers kilomètres d’une sortie longue pour un échauffement', () => {
    const workout = workoutOf(RunSessionCode.LongRun, { withHalfPaceFinish: true })

    expect(kindsOf(workout.blocks)).toEqual([WorkoutStepKind.Active, WorkoutStepKind.Active])
    expect(workout.blocks.at(-1)!.steps[0]!.distanceM).toBeGreaterThan(0)
  })

  it('passe le dernier tiers d’une sortie longue de spécifique à l’allure semi', () => {
    const plain = workoutOf(RunSessionCode.LongRun)
    const specific = workoutOf(RunSessionCode.LongRun, { withHalfPaceFinish: true })

    expect(plain.blocks).toHaveLength(1)
    expect(specific.blocks).toHaveLength(2)
    expect(specific.blocks[1]!.steps[0]!.paceSecPerKm).toBeLessThan(
      specific.blocks[0]!.steps[0]!.paceSecPerKm!,
    )
  })

  it('court le test en durée, même quand la distance est connue', () => {
    const workout = workoutOf(RunSessionCode.Test)
    const test = workout.blocks[1]!.steps[0]!

    expect(test.durationS).toBe(1200)
    expect(test.distanceM).toBeUndefined()
  })

  it('ne rend aucune séance pour du renforcement, et ne lève pas d’erreur', () => {
    const strength = strengthPrescription(StrengthSessionCode.Legs, {
      phase: StrengthPhase.Force,
      progressionWeek: 3,
    })

    expect(structuredWorkout(strength)).toBeUndefined()
  })
})
