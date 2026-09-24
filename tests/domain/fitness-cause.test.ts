import { describe, expect, it } from 'vitest'
import { fitnessCause } from '~~/server/domain/fitness/cause'
import { FitnessOrigin } from '~~/server/domain/fitness/fitness-point'

/** L'histoire de la forme dit pourquoi elle a bougé (P22). */
const vannes = { date: '2026-06-21', vdot: 34.5, isFloor: false, origin: FitnessOrigin.Race }
const semi = { date: '2026-09-13', vdot: 33.15, isFloor: true, origin: FitnessOrigin.Race }
const test = { date: '2026-10-20', vdot: 33.75, isFloor: false, origin: FitnessOrigin.Test }

describe('cause d’un point de forme', () => {
  it('nomme la course et son chrono', () => {
    const race = { name: '10 km de Vannes', distanceM: 10000, resultatS: 3400, incident: null }
    expect(fitnessCause(vannes, undefined, { race })).toBe('10 km de Vannes en 56:40')
  })

  it('dit pourquoi une course n’a donné qu’un plancher, et l’écart signé', () => {
    const race = {
      name: 'Premier semi-marathon',
      distanceM: 21500,
      resultatS: 8760,
      incident: { km: 14, type: 'blessure', note: 'genou droit' },
    }
    expect(fitnessCause(semi, vannes, { race })).toBe(
      'Premier semi-marathon : plancher, blessure au km 14 · −1,4',
    )
  })

  it('donne la distance d’un test 20′', () => {
    expect(fitnessCause(test, semi, {})).toBe('Test 20′ : 3,7 km · +0,6')
  })

  it('redit l’allure déclarée', () => {
    const declared = { date: '2026-09-20', vdot: 35, isFloor: true, origin: FitnessOrigin.Declared }
    expect(fitnessCause(declared, undefined, {})).toBe('Allure d’endurance déclarée, 6:47/km')
  })
})
