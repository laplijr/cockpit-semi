import { describe, expect, it } from 'vitest'
import { LoadImplement } from '~~/server/domain/strength/estimated-max'
import { adjustNextSet, rpeFromReserve, warmupSets } from '~~/server/domain/strength/next-set'

/** Le réglage en cours de séance, en salle (P27). */
describe('série suivante', () => {
  const barbell = LoadImplement.Barbell

  it('propose 5 % de moins après une série ratée à l’échec', () => {
    const adjustment = adjustNextSet(
      { loadKg: 52.5, reps: 7, targetReps: 9, reserve: 0 },
      1,
      barbell,
    )
    expect(adjustment).toEqual({ loadKg: 50, reason: 'série 1 à l’échec' })
  })

  it('propose 5 % de plus après une série tenue avec quatre en réserve ou plus', () => {
    const adjustment = adjustNextSet({ loadKg: 60, reps: 5, targetReps: 5, reserve: 4 }, 2, barbell)
    expect(adjustment?.loadKg).toBe(62.5)
  })

  it('ne propose rien entre les deux', () => {
    expect(adjustNextSet({ loadKg: 60, reps: 5, targetReps: 5, reserve: 2 }, 1, barbell)).toBeNull()
    expect(adjustNextSet({ loadKg: 60, reps: 5, targetReps: 5, reserve: 0 }, 1, barbell)).toBeNull()
  })

  it('ne descend jamais sous la barre à vide', () => {
    expect(adjustNextSet({ loadKg: 20, reps: 4, targetReps: 8, reserve: 0 }, 1, barbell)).toBeNull()
  })

  it('stocke la réserve comme RPE de la série', () => {
    expect(rpeFromReserve(0)).toBe(10)
    expect(rpeFromReserve(2)).toBe(8)
    expect(rpeFromReserve(6)).toBe(6)
  })
})

describe('échauffement', () => {
  it('pose la barre à vide × 8 puis deux tiers de la charge × 4 à 75 % ou plus', () => {
    expect(warmupSets(LoadImplement.Barbell, '85 %', 60, false)).toEqual([
      { loadKg: 20, reps: 8 },
      { loadKg: 40, reps: 4 },
    ])
  })

  it('ne pose rien sous 75 %, aux haltères, ou après un calage du jour', () => {
    expect(warmupSets(LoadImplement.Barbell, '70 %', 52.5, false)).toEqual([])
    expect(warmupSets(LoadImplement.Dumbbell, '85 %', 20, false)).toEqual([])
    expect(warmupSets(LoadImplement.Barbell, '85 %', 60, true)).toEqual([])
  })
})
