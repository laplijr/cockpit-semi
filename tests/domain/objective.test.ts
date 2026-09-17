import { describe, expect, it } from 'vitest'
import {
  levelsAreOrdered,
  objectiveIsUnset,
  proposeLevels,
} from '~~/server/domain/fitness/objective'
import { confidence } from '~~/server/domain/fitness/confidence'
import type { Projection } from '~~/server/domain/fitness/projection'

const projection: Projection = { vdot: 35, timeS: 7200, lowS: 6960, highS: 7440 }

describe('objectif à trois niveaux (§ 5, P5.15)', () => {
  it('propose les trois bornes de l’intervalle', () => {
    expect(proposeLevels(projection)).toEqual({
      ambitionS: 6960,
      realisticS: 7200,
      floorS: 7440,
    })
  })

  it('accepte les trois niveaux strictement ordonnés', () => {
    expect(levelsAreOrdered(proposeLevels(projection))).toBe(true)
  })

  it('refuse un ordre inversé', () => {
    expect(levelsAreOrdered({ ambitionS: 7440, realisticS: 7200, floorS: 6960 })).toBe(false)
  })

  it('refuse deux niveaux égaux : trois niveaux identiques ne disent rien', () => {
    expect(levelsAreOrdered({ ambitionS: 7200, realisticS: 7200, floorS: null })).toBe(false)
  })

  it('accepte un niveau seul, et deux niveaux ordonnés', () => {
    expect(levelsAreOrdered({ ambitionS: null, realisticS: 7200, floorS: null })).toBe(true)
    expect(levelsAreOrdered({ ambitionS: 6960, realisticS: null, floorS: 7440 })).toBe(true)
  })

  it('ne dit « à fixer » que lorsque les trois niveaux sont vides', () => {
    expect(objectiveIsUnset({ ambitionS: null, realisticS: null, floorS: null })).toBe(true)
    expect(objectiveIsUnset({ ambitionS: null, realisticS: 7200, floorS: null })).toBe(false)
  })

  it('donne trois confiances croissantes, lues comme un curseur de risque', () => {
    const levels = proposeLevels(projection)
    const pcts = [levels.ambitionS, levels.realisticS, levels.floorS].map((targetS) =>
      confidence(projection, { targetS })!,
    )

    expect(pcts[0]!).toBeLessThan(pcts[1]!)
    expect(pcts[1]!).toBeLessThan(pcts[2]!)
  })
})
