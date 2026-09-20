import { describe, expect, it } from 'vitest'
import { RunSessionCode, prescription } from '~~/server/domain/running/session-types'
import { structuredWorkout } from '~~/server/domain/watch/workout'
import {
  PACE_WINDOW_S_PER_KM,
  decodeWorkout,
  encodeWorkout,
} from '~~/server/infra/watch/fit-encoder'

const CONTEXT = { vdot: 34, weeklyVolumeM: 45_000, phaseProgress: 0.5 }
const CREATED_AT = new Date('2026-09-20T08:00:00Z')

/** Les trois séances de référence de l'aller-retour (§ 9, P6.7). */
const REFERENCES = [
  { code: RunSessionCode.Threshold, label: 'seuil en répétitions' },
  { code: RunSessionCode.LongRun, label: 'sortie longue' },
  { code: RunSessionCode.Hills, label: 'côtes à l’effort' },
] as const

function roundTrip(code: RunSessionCode, overrides = {}) {
  const workout = structuredWorkout(prescription(code, { ...CONTEXT, ...overrides }))!
  return { workout, decoded: decodeWorkout(encodeWorkout(workout, CREATED_AT)) }
}

describe('fichier FIT de séance (§ 9, P6.7)', () => {
  it.each(REFERENCES)('se relit à l’identique sur la $label', ({ code }) => {
    const { workout, decoded } = roundTrip(code)

    expect(decoded.name).toBe(workout.name)

    /** Les étapes réelles, hors renvois de répétition ajoutés par l'encodage. */
    const effort = decoded.steps.filter((step) => step.durationType !== 'repeatUntilStepsCmplt')
    const expected = workout.blocks.flatMap((block) => block.steps)

    expect(effort.map((step) => step.name)).toEqual(expected.map((step) => step.label))
  })

  it('rend les répétitions du seuil et leur récupération', () => {
    const { workout, decoded } = roundTrip(RunSessionCode.Threshold)
    const repeated = workout.blocks.find((block) => block.repeats > 1)!

    const loop = decoded.steps.find((step) => step.durationType === 'repeatUntilStepsCmplt')!
    expect(loop.repeats).toBe(repeated.repeats)

    const recovery = decoded.steps.find((step) => step.intensity === 'rest')!
    expect(recovery.durationS).toBe(120)
  })

  it('rend les durées et les distances dans leurs unités', () => {
    const { workout, decoded } = roundTrip(RunSessionCode.Threshold)
    const source = workout.blocks.flatMap((block) => block.steps)

    const warmup = decoded.steps.find((step) => step.intensity === 'warmup')!
    expect(warmup.distanceM).toBe(source[0]!.distanceM)

    const effort = decoded.steps.find((step) => step.name === 'Seuil')!
    expect(effort.durationS).toBe(source[1]!.durationS)
  })

  it('encadre l’allure prescrite d’une fenêtre, sans la déplacer', () => {
    const { workout, decoded } = roundTrip(RunSessionCode.Threshold)

    const effort = decoded.steps.find((step) => step.name === 'Seuil')!
    const source = workout.blocks.flatMap((b) => b.steps).find((s) => s.label === 'Seuil')!

    expect(effort.paceSecPerKm).toBeGreaterThan(source.paceSecPerKm! - PACE_WINDOW_S_PER_KM)
    expect(effort.paceSecPerKm).toBeLessThan(source.paceSecPerKm! + PACE_WINDOW_S_PER_KM)
  })

  it('laisse les côtes sans cible d’allure et porte l’effort en note', () => {
    const { decoded } = roundTrip(RunSessionCode.Hills)
    const hills = decoded.steps.find((step) => step.durationS === 30)!

    expect(hills.paceSecPerKm).toBeUndefined()
    expect(hills.notes).toMatch(/RPE \d/)
  })

  it('produit un fichier que le décodeur accepte sans erreur', () => {
    const workout = structuredWorkout(prescription(RunSessionCode.Vma, CONTEXT))!
    const bytes = encodeWorkout(workout, CREATED_AT)

    expect(bytes.length).toBeGreaterThan(100)
    expect(decodeWorkout(bytes).steps.length).toBeGreaterThan(2)
  })
})
