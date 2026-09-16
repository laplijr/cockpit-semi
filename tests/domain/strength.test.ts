import { describe, expect, it } from 'vitest'
import { PhaseType } from '~~/server/domain/plan/phases'
import { STRENGTH_PER_PHASE } from '~~/server/domain/plan/week-support'
import {
  EFFORT_RECOVERY_S,
  STRENGTH_EXERCISES,
  StrengthEffort,
  StrengthGroup,
  strengthExercise,
} from '~~/server/domain/strength/exercises'
import {
  HARD_SET_RPE,
  LOWER_BODY_STEP_KG,
  UPPER_BODY_STEP_KG,
  nextLoadKg,
  type StrengthSetRecord,
} from '~~/server/domain/strength/next-load'
import {
  ADAPTATION_WEEKS,
  STRENGTH_DOSES,
  StrengthPhase,
  strengthPhaseFor,
} from '~~/server/domain/strength/phases'
import {
  StrengthSessionCode,
  estimatedDurationS,
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

const prescribe = (code: StrengthSessionCode, phase: StrengthPhase, progressionWeek = 1) =>
  strengthPrescription(code, { phase, progressionWeek })

describe('repos entre séries (§ 5)', () => {
  it('suit la nature de l’effort, pas le rang dans la séance', () => {
    const legs = prescribe(StrengthSessionCode.Legs, StrengthPhase.Force)
    const squat = legs.steps.find((step) => step.exerciseId === 'squat')!
    const fente = legs.steps.find((step) => step.exerciseId === 'fente-bulgare')!
    const mollet = legs.steps.find((step) => step.exerciseId === 'mollet-unipodal')!

    expect(squat.recoveryS).toBe(EFFORT_RECOVERY_S[StrengthEffort.MaxStrength])
    expect(fente.recoveryS).toBe(EFFORT_RECOVERY_S[StrengthEffort.Hypertrophy])
    // Les mollets s'alternent : leur repos est celui que § 5 leur donne, pas celui de l'effort.
    expect(mollet.recoveryS).toBe(30)
  })

  it('module le repos par le facteur de la phase, sans le remplacer', () => {
    const maintenance = prescribe(StrengthSessionCode.Legs, StrengthPhase.Maintenance)
    const squat = maintenance.steps.find((step) => step.exerciseId === 'squat')!
    const factor = STRENGTH_DOSES[StrengthPhase.Maintenance].restFactor

    expect(squat.recoveryS).toBe(Math.round(EFFORT_RECOVERY_S[StrengthEffort.MaxStrength] * factor))
  })

  it('pose un repos sur toutes les étapes chargées, accessoires compris', () => {
    for (const code of [
      StrengthSessionCode.Legs,
      StrengthSessionCode.Push,
      StrengthSessionCode.Pull,
    ]) {
      const steps = prescribe(code, StrengthPhase.Force).steps.filter((step) => step.exerciseId)
      expect(steps.every((step) => (step.recoveryS ?? 0) > 0)).toBe(true)
    }
  })

  it('donne à chaque exercice un effort et une durée de répétition', () => {
    for (const exercise of STRENGTH_EXERCISES) {
      expect(EFFORT_RECOVERY_S[exercise.effort]).toBeGreaterThan(0)
      expect(exercise.repDurationS).toBeGreaterThan(0)
    }
  })
})

describe('prescription', () => {
  it('dose l’exercice principal selon la phase', () => {
    const adaptation = prescribe(StrengthSessionCode.Legs, StrengthPhase.Adaptation)
    const force = prescribe(StrengthSessionCode.Legs, StrengthPhase.Force)

    expect(adaptation.steps[1]!.repeats).toBe(3)
    expect(adaptation.steps[1]!.reps).toBe(9)
    expect(force.steps[1]!.repeats).toBe(4)
    expect(force.steps[1]!.reps).toBe(5)
  })

  it('n’ajoute la pliométrie qu’en force-puissance (§ 5)', () => {
    const hasPlyo = (phase: StrengthPhase) =>
      prescribe(StrengthSessionCode.Legs, phase).steps.some(
        (step) => step.exerciseId === 'pliometrie',
      )

    expect(hasPlyo(StrengthPhase.ForcePower)).toBe(true)
    expect(hasPlyo(StrengthPhase.Force)).toBe(false)
  })

  it('pose la pliométrie en première étape chargée, à froid (§ 5)', () => {
    const steps = prescribe(StrengthSessionCode.Legs, StrengthPhase.ForcePower).steps
    const firstLoaded = steps.find((step) => step.exerciseId)

    expect(firstLoaded!.exerciseId).toBe('pliometrie')
  })

  it('termine chaque séance chargée par des exercices de prévention réels', () => {
    const legs = prescribe(StrengthSessionCode.Legs, StrengthPhase.Force)
    const mobility = prescribe(StrengthSessionCode.Mobility, StrengthPhase.Mobility)

    expect(legs.steps.at(-1)!.exerciseId).toBe('short-foot')
    expect(legs.steps.some((step) => step.label === 'Bloc prévention')).toBe(false)
    expect(mobility.steps.at(-1)!.exerciseId).toBe('respiration')
  })

  /**
   * Les durées annoncées au § 5 et ses repos par exercice ne tombent pas
   * exactement juste : la règle implémentée est celle des repos, et la durée
   * s'en déduit — et elle sort 7 à 17 % au-dessus des minutes annoncées. La
   * marge de 20 % reste un garde-fou contre une séance qui doublerait ou
   * disparaîtrait ; elle n'entérine pas l'écart.
   */
  it('calcule la durée au lieu de la poser par type (§ 5)', () => {
    const cases = [
      [StrengthSessionCode.Legs, StrengthPhase.Force, 55],
      [StrengthSessionCode.Legs, StrengthPhase.ForcePower, 61],
      [StrengthSessionCode.Push, StrengthPhase.Force, 41],
      [StrengthSessionCode.Pull, StrengthPhase.Force, 42],
      [StrengthSessionCode.Power, StrengthPhase.ForcePower, 35],
      [StrengthSessionCode.Cycling, StrengthPhase.Force, 40],
      [StrengthSessionCode.Comeback, StrengthPhase.Adaptation, 30],
    ] as const

    for (const [code, phase, expected] of cases) {
      const actual = prescribe(code, phase).durationMin!
      expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(0.2)
    }
  })

  it('garde la mobilité la plus courte et la force-puissance la plus longue', () => {
    const mobility = prescribe(StrengthSessionCode.Mobility, StrengthPhase.Mobility).durationMin!
    const power = prescribe(StrengthSessionCode.Legs, StrengthPhase.ForcePower).durationMin!

    expect(mobility).toBeLessThan(power)
    expect(mobility).toBeGreaterThan(15)
  })

  it('fait varier le RPE avec la phase : un Legs d’affûtage ne pèse pas comme une force-puissance', () => {
    const light = prescribe(StrengthSessionCode.Full, StrengthPhase.Light)
    const power = prescribe(StrengthSessionCode.Legs, StrengthPhase.ForcePower)

    expect(light.expectedRpe).toBeLessThan(power.expectedRpe)
  })

  it('retire les exercices exclus sans vider la séance', () => {
    const filtered = strengthPrescription(StrengthSessionCode.Legs, {
      phase: StrengthPhase.Force,
      progressionWeek: 1,
      excludedIds: ['nordic', 'sdt-roumain'],
    })

    expect(filtered.steps.some((step) => step.exerciseId === 'nordic')).toBe(false)
    expect(filtered.steps.some((step) => step.exerciseId === 'squat')).toBe(true)
  })

  it('compte la durée d’une série unilatérale des deux côtés', () => {
    const unilateral = estimatedDurationS([
      { label: 'x', exerciseId: 'a', repeats: 1, reps: 10, repDurationS: 3, unilateral: true },
    ])
    const bilateral = estimatedDurationS([
      { label: 'x', exerciseId: 'a', repeats: 1, reps: 10, repDurationS: 3 },
    ])

    expect(unilateral - bilateral).toBe(30)
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
    expect(progressionStep(squat, 4)).toEqual({ sets: 4, reps: 5 })
  })

  it('se compte en continu, même quand la phase course change en route (§ 5)', () => {
    const legs = (progressionWeek: number) =>
      strengthPrescription(StrengthSessionCode.Legs, {
        phase: progressionWeek > 3 ? StrengthPhase.Force : StrengthPhase.Adaptation,
        progressionWeek,
      }).steps.find((step) => step.exerciseId === 'nordic')!

    expect(legs(6).repeats).toBe(3)
    expect(legs(6).reps).toBe(8)
    expect(legs(6).repeats! * legs(6).reps!).toBeGreaterThan(legs(3).repeats! * legs(3).reps!)
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
