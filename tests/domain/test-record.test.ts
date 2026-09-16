import { describe, expect, it } from 'vitest'
import { TEST_DURATION_S, vdotFromTest } from '~~/server/application/record-test'
import { RACE_DISTANCES_M, raceTimeForVdot } from '~~/server/domain/fitness/vdot'

describe('test 20′', () => {
  it('lit la distance couverte comme un résultat de course', () => {
    const vdot = vdotFromTest(4000)
    expect(raceTimeForVdot(vdot, 4000)).toBeCloseTo(TEST_DURATION_S, 3)
  })

  it('monte quand la distance couverte augmente', () => {
    expect(vdotFromTest(4500)).toBeGreaterThan(vdotFromTest(4000))
  })

  it('situe un test à 4 km au-dessus du plancher de la course de référence', () => {
    expect(vdotFromTest(4000)).toBeGreaterThan(33.15)
  })

  it('projette un semi cohérent avec le VDOT obtenu', () => {
    const vdot = vdotFromTest(4200)
    expect(raceTimeForVdot(vdot, RACE_DISTANCES_M.halfMarathon)).toBeGreaterThan(5000)
  })

  it('refuse une distance nulle ou négative', () => {
    expect(() => vdotFromTest(0)).toThrow()
    expect(() => vdotFromTest(-100)).toThrow()
  })
})
