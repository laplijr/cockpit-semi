import { describe, expect, it } from 'vitest'
import { PhaseType } from '~~/server/domain/plan/phases'
import { STRENGTH_PER_PHASE } from '~~/server/domain/plan/week-support'
import { StrengthGroup, strengthExercise } from '~~/server/domain/strength/exercises'
import {
  HARD_SET_RPE,
  LOWER_BODY_STEP_KG,
  UPPER_BODY_STEP_KG,
  nextLoadKg,
  type StrengthSetRecord,
} from '~~/server/domain/strength/next-load'
import { ADAPTATION_WEEKS, StrengthPhase, strengthPhaseFor } from '~~/server/domain/strength/phases'
import {
  StrengthSessionCode,
  progressionStep,
  strengthPrescription,
} from '~~/server/domain/strength/session-types'

describe('phases de musculation (§ 5)', () => {
  it('commence une base par trois semaines d’adaptation puis passe en force', () => {
    expect(strengthPhaseFor(PhaseType.Base, 1)).toBe(StrengthPhase.Adaptation)
    expect(strengthPhaseFor(PhaseType.Base, ADAPTATION_WEEKS)).toBe(StrengthPhase.Adaptation)
    expect(strengthPhaseFor(PhaseType.Base, ADAPTATION_WEEKS + 1)).toBe(StrengthPhase.Force)
  })

  it('travaille la force-puissance en développement et en vitesse', () => {
    expect(strengthPhaseFor(PhaseType.Development, 2)).toBe(StrengthPhase.ForcePower)
    expect(strengthPhaseFor(PhaseType.Speed, 2)).toBe(StrengthPhase.ForcePower)
  })

  it('entretient en spécifique, allège en affûtage, passe en mobilité en récup', () => {
    expect(strengthPhaseFor(PhaseType.Specific, 1)).toBe(StrengthPhase.Maintenance)
    expect(strengthPhaseFor(PhaseType.Taper, 1)).toBe(StrengthPhase.Light)
    expect(strengthPhaseFor(PhaseType.Recovery, 1)).toBe(StrengthPhase.Mobility)
  })
})

describe('nombre de séances par phase (§ 5)', () => {
  it('pose trois séances en base, développement et vitesse', () => {
    for (const phase of [PhaseType.Base, PhaseType.Development, PhaseType.Speed]) {
      expect(STRENGTH_PER_PHASE[phase]).toHaveLength(3)
    }
  })

  it('en pose deux en spécifique et en relance, une en affûtage, aucune en transition', () => {
    expect(STRENGTH_PER_PHASE[PhaseType.Specific]).toHaveLength(2)
    expect(STRENGTH_PER_PHASE[PhaseType.Rebuild]).toHaveLength(2)
    expect(STRENGTH_PER_PHASE[PhaseType.Taper]).toHaveLength(1)
    expect(STRENGTH_PER_PHASE[PhaseType.Transition]).toHaveLength(0)
  })
})

describe('prescription', () => {
  it('dose l’exercice principal selon la phase', () => {
    const adaptation = strengthPrescription(StrengthSessionCode.Legs, {
      phase: StrengthPhase.Adaptation,
      weekInPhase: 1,
    })
    const force = strengthPrescription(StrengthSessionCode.Legs, {
      phase: StrengthPhase.Force,
      weekInPhase: 1,
    })

    expect(adaptation.steps[0]!.repeats).toBe(3)
    expect(adaptation.steps[0]!.reps).toBe(9)
    expect(force.steps[0]!.repeats).toBe(4)
    expect(force.steps[0]!.reps).toBe(5)
  })

  it('n’ajoute la pliométrie qu’en force-puissance (§ 5)', () => {
    const hasPlyo = (phase: StrengthPhase) =>
      strengthPrescription(StrengthSessionCode.Legs, { phase, weekInPhase: 1 }).steps.some(
        (step) => step.exerciseId === 'pliometrie',
      )

    expect(hasPlyo(StrengthPhase.ForcePower)).toBe(true)
    expect(hasPlyo(StrengthPhase.Force)).toBe(false)
  })

  it('termine chaque séance chargée par le bloc prévention, sauf la mobilité', () => {
    const legs = strengthPrescription(StrengthSessionCode.Legs, {
      phase: StrengthPhase.Force,
      weekInPhase: 1,
    })
    const mobility = strengthPrescription(StrengthSessionCode.Mobility, {
      phase: StrengthPhase.Mobility,
      weekInPhase: 1,
    })

    expect(legs.steps.at(-1)!.label).toBe('Bloc prévention')
    expect(mobility.steps.some((step) => step.label === 'Bloc prévention')).toBe(false)
  })

  it('ne dose pas la mobilité : chaque exercice garde son format', () => {
    const mobility = strengthPrescription(StrengthSessionCode.Mobility, {
      phase: StrengthPhase.ForcePower,
      weekInPhase: 1,
    })

    expect(mobility.steps.every((step) => step.intensity === undefined)).toBe(true)
    expect(mobility.steps[0]!.repeats).toBe(2)
  })

  it('porte sa durée : une muscu se compte en séries, pas en minutes', () => {
    const push = strengthPrescription(StrengthSessionCode.Push, {
      phase: StrengthPhase.Force,
      weekInPhase: 1,
    })
    expect(push.durationMin).toBe(45)
  })
})

describe('progression du Nordic hamstring (§ 5)', () => {
  const nordic = strengthExercise('nordic')!

  it('va de 1 × 4 à 3 × 8 en six semaines', () => {
    expect(progressionStep(nordic, 1)).toEqual({ sets: 1, reps: 4 })
    expect(progressionStep(nordic, 6)).toEqual({ sets: 3, reps: 8 })
  })

  it('ne redescend jamais d’une semaine à la suivante', () => {
    const volumes = [1, 2, 3, 4, 5, 6].map((week) => {
      const step = progressionStep(nordic, week)
      return step.sets * step.reps
    })

    for (const [index, volume] of volumes.slice(1).entries()) {
      expect(volume).toBeGreaterThanOrEqual(volumes[index]!)
    }
  })

  it('laisse les exercices sans progression à leur format', () => {
    const squat = strengthExercise('squat')!
    expect(squat.group).toBe(StrengthGroup.Legs)
    expect(progressionStep(squat, 4)).toEqual({ sets: 4, reps: 4 })
  })
})

describe('charge suivante (§ 9, P4)', () => {
  const sets = (reps: number, rpe: number, loadKg = 60): StrengthSetRecord[] =>
    [1, 2, 3].map((index) => ({ exerciseId: 'squat', index, reps, loadKg, rpe }))

  it('monte la charge quand le format est tenu sans arriver à l’échec', () => {
    expect(nextLoadKg('squat', 5, sets(5, 7))).toBe(60 + LOWER_BODY_STEP_KG)
  })

  it('monte moins vite sur le haut du corps', () => {
    const push = sets(5, 7).map((set) => ({ ...set, exerciseId: 'developpe-couche' }))
    expect(nextLoadKg('developpe-couche', 5, push)).toBe(60 + UPPER_BODY_STEP_KG)
  })

  it('garde la charge quand la série part à l’échec', () => {
    expect(nextLoadKg('squat', 5, sets(5, HARD_SET_RPE))).toBe(60)
  })

  it('redescend quand le format n’est pas tenu', () => {
    expect(nextLoadKg('squat', 5, sets(3, 8))).toBe(57)
  })

  it('ne propose rien sans série enregistrée', () => {
    expect(nextLoadKg('squat', 5, [])).toBeUndefined()
  })
})
