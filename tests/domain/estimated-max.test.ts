import { describe, expect, it } from 'vitest'
import {
  LoadImplement,
  estimateFromSets,
  estimatedMaxKg,
  intensityShare,
  isCalibratable,
  plateBreakdown,
  proposedLoadKg,
  workingLoadKg,
} from '~~/server/domain/strength/estimated-max'

/** Des kilos dès la première séance (P26). */
describe('maximum estimé', () => {
  it('ajoute la réserve aux répétitions faites : 60 kg × 5 avec 3 en réserve valent 76 kg', () => {
    expect(estimatedMaxKg(60, 5, 3)).toBe(76)
  })

  it('donne 52,5 kg à 70 % et 62,5 kg à 85 %, au pas inférieur de la barre', () => {
    expect(workingLoadKg(76, '70 %', LoadImplement.Barbell)).toBe(52.5)
    expect(workingLoadKg(76, '85 %', LoadImplement.Barbell)).toBe(62.5)
    expect(workingLoadKg(76, '≥ 85 %', LoadImplement.Barbell)).toBe(62.5)
  })

  it('arrondit un haltère au pas de 2 kg et ne descend jamais sous la barre à vide', () => {
    expect(workingLoadKg(21, '70 %', LoadImplement.Dumbbell)).toBe(14)
    expect(workingLoadKg(20, '70 %', LoadImplement.Barbell)).toBe(20)
  })

  it('ne rend rien pour un repère qui n’est pas un pourcentage', () => {
    expect(workingLoadKg(76, 'modérée', LoadImplement.Barbell)).toBeNull()
    expect(intensityShare('à vide')).toBeNull()
    expect(intensityShare('≥ 85 %')).toBe(0.85)
  })

  it('met 15 + 1,25 kg de chaque côté pour 52,5 kg', () => {
    expect(plateBreakdown(52.5)).toEqual([15, 1.25])
    expect(plateBreakdown(20)).toEqual([])
    expect(plateBreakdown(100)).toEqual([25, 15])
  })

  it('cale un exercice chargé et dosé en pourcentage, pas les autres', () => {
    expect(isCalibratable('squat', '70 %')).toBe(true)
    expect(isCalibratable('squat', 'à vide')).toBe(false)
    expect(isCalibratable('pompes', '70 %')).toBe(false)
  })

  it('estime depuis la meilleure série, avec une réserve de 10 − RPE', () => {
    const sets = [
      { loadKg: 50, reps: 9, rpe: 7 },
      { loadKg: 55, reps: 6, rpe: 9 },
      { loadKg: 0, reps: 12, rpe: 5 },
    ]
    expect(estimateFromSets(sets)).toBe(estimatedMaxKg(50, 9, 3))
    expect(estimateFromSets([{ loadKg: 0, reps: 10, rpe: 6 }])).toBeNull()
  })

  it('suit le pourcentage au changement de phase, là où la progression ne montait que d’un pas', () => {
    const squat = { exerciseId: 'squat', estimateKg: 76, nextLoadKg: 57.5 }
    expect(proposedLoadKg({ ...squat, intensity: '70 %' })).toBe(52.5)
    expect(proposedLoadKg({ ...squat, intensity: '85 %' })).toBe(62.5)
  })

  it('garde la règle de progression sans estimation, ou pour un repère qui n’est pas un pourcentage', () => {
    expect(
      proposedLoadKg({ exerciseId: 'squat', intensity: '70 %', estimateKg: null, nextLoadKg: 55 }),
    ).toBe(55)
    expect(
      proposedLoadKg({
        exerciseId: 'rowing',
        intensity: 'modérée',
        estimateKg: 30,
        nextLoadKg: 22,
      }),
    ).toBe(22)
  })
})
