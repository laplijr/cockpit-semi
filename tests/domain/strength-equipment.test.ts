import { describe, expect, it } from 'vitest'
import { equipmentOf } from '~~/server/domain/athlete/constraints'
import { StrengthEquipment } from '~~/server/domain/strength/equipment'
import {
  StrengthEffort,
  resolveForEquipment,
  strengthExercise,
  substitutionChain,
} from '~~/server/domain/strength/exercises'
import { nextLoadKg, nextRepsTarget } from '~~/server/domain/strength/next-load'
import { StrengthPhase } from '~~/server/domain/strength/phases'
import {
  StrengthSessionCode,
  chargesLegsHeavily,
  strengthPrescription,
} from '~~/server/domain/strength/session-types'

/**
 * Le matériel résout les exercices, l'intention choisit les séances (§ 5,
 * P11.3). Les trois conséquences sont déduites de la substitution : le repos
 * et le RPE suivent la nature d'effort du remplaçant, G1 cesse de mordre
 * faute d'un exercice à 85 %, et la progression passe aux répétitions.
 */
describe('matériel disponible', () => {
  it('suppose la salle tant que rien n’est déclaré', () => {
    expect(equipmentOf({ availableDays: [1] })).toBe(StrengthEquipment.Gym)
  })

  it('descend la chaîne d’un cran à la fois jusqu’à ce qu’elle tienne', () => {
    expect(resolveForEquipment('squat', StrengthEquipment.Gym)?.id).toBe('squat')
    expect(resolveForEquipment('squat', StrengthEquipment.Home)?.id).toBe('goblet-squat')
    expect(resolveForEquipment('squat', StrengthEquipment.None)?.id).toBe('fente-bulgare')
  })

  it('rend un exercice complet de la bibliothèque, jamais un libellé', () => {
    const replacement = resolveForEquipment('tractions', StrengthEquipment.None)

    expect(replacement?.id).toBe('rowing-australien')
    expect(replacement?.why).not.toBe(strengthExercise('tractions')?.why)
    expect(replacement?.sets).toBeGreaterThan(0)
    expect(replacement?.effort).toBeDefined()
  })

  it('laisse passer tel quel ce qui ne demande rien : mollets, Nordic, pliométrie, mobilité', () => {
    for (const id of ['mollet-unipodal', 'nordic', 'pliometrie', 'genou-au-mur', 'dead-bug']) {
      expect(resolveForEquipment(id, StrengthEquipment.None)?.id).toBe(id)
    }
  })

  it('donne la chaîne entière à la fenêtre d’exercice', () => {
    expect(substitutionChain('squat').map((exercise) => exercise.id)).toEqual([
      'squat',
      'goblet-squat',
      'fente-bulgare',
    ])
  })

  it('ne prescrit aucun exercice qui demande un objet non déclaré', () => {
    const session = strengthPrescription(StrengthSessionCode.Footing, {
      phase: StrengthPhase.Force,
      progressionWeek: 4,
      equipment: StrengthEquipment.None,
    })

    for (const step of session.steps) {
      if (!step.exerciseId) continue
      expect(strengthExercise(step.exerciseId)?.equipment ?? StrengthEquipment.None).toBe(
        StrengthEquipment.None,
      )
    }
    expect(session.steps.some((step) => step.replacesId === 'squat')).toBe(true)
  })

  it('laisse le repos suivre la nature d’effort du remplaçant', () => {
    const gym = strengthPrescription(StrengthSessionCode.Footing, {
      phase: StrengthPhase.Force,
      progressionWeek: 4,
    })
    const home = strengthPrescription(StrengthSessionCode.Footing, {
      phase: StrengthPhase.Force,
      progressionWeek: 4,
      equipment: StrengthEquipment.None,
    })

    const squat = gym.steps.find((step) => step.exerciseId === 'squat')
    const replacement = home.steps.find((step) => step.replacesId === 'squat')

    expect(strengthExercise('squat')?.effort).toBe(StrengthEffort.MaxStrength)
    expect(replacement?.recoveryS).toBeLessThan(squat!.recoveryS!)
  })

  it('allège l’effort attendu quand la séance n’a plus d’exercice à 85 %', () => {
    const context = { phase: StrengthPhase.Force, progressionWeek: 4 }
    const gym = strengthPrescription(StrengthSessionCode.Footing, context)
    const bodyweight = strengthPrescription(StrengthSessionCode.Footing, {
      ...context,
      equipment: StrengthEquipment.None,
    })

    expect(bodyweight.expectedRpe).toBe(gym.expectedRpe - 1)
    expect(bodyweight.steps.some((step) => step.intensity === '85 %')).toBe(false)
  })

  it('G1 cesse de mordre au poids de corps, et tient à la salle', () => {
    expect(
      chargesLegsHeavily(StrengthSessionCode.Footing, StrengthPhase.Force, StrengthEquipment.Gym),
    ).toBe(true)
    expect(
      chargesLegsHeavily(StrengthSessionCode.Footing, StrengthPhase.Force, StrengthEquipment.None),
    ).toBe(false)
  })

  it('ne propose plus zéro kilo pour toujours : c’est le format qui monte', () => {
    const sets = [1, 2, 3].map((index) => ({
      exerciseId: 'pompes',
      index,
      reps: 12,
      loadKg: 0,
      rpe: 7,
    }))

    expect(nextLoadKg('pompes', 12, sets)).toBeUndefined()
    expect(nextRepsTarget('pompes', 12, sets)).toBe(13)
  })

  it('redescend d’une répétition quand le format n’a pas été tenu', () => {
    const sets = [{ exerciseId: 'pompes', index: 1, reps: 6, loadKg: 0, rpe: 9 }]

    expect(nextRepsTarget('pompes', 12, sets)).toBe(11)
  })

  it('ne dit rien du format quand il y a une charge : c’est elle qui progresse', () => {
    const sets = [{ exerciseId: 'squat', index: 1, reps: 5, loadKg: 60, rpe: 7 }]

    expect(nextRepsTarget('squat', 5, sets)).toBeUndefined()
    expect(nextLoadKg('squat', 5, sets)).toBeGreaterThan(60)
  })
})
