import { describe, expect, it } from 'vitest'
import { confidence } from '~~/server/domain/fitness/confidence'
import {
  MAX_INTERVAL_SHARE,
  MIN_INTERVAL_SHARE,
  expectedGain,
  intervalS,
  project,
  testVariability,
} from '~~/server/domain/fitness/projection'
import { raceTimeForVdot } from '~~/server/domain/fitness/vdot'

const SEMI_M = 21097.5
const BASE = {
  vdot: 33.75,
  isFloor: false,
  testHistory: [33.15, 33.75],
  distanceM: SEMI_M,
}

describe('gain du bloc restant (§ 5)', () => {
  it('vaut +0,4 VDOT sur huit semaines pleines et +0,2 sur quatre', () => {
    expect(expectedGain(8)).toBeCloseTo(0.4, 6)
    expect(expectedGain(4)).toBeCloseTo(0.2, 6)
  })

  it('annule la moitié du gain quand quatre des huit semaines sont en pause', () => {
    expect(expectedGain(8, 4)).toBeCloseTo(0.2, 6)
  })

  it('ne descend jamais sous zéro', () => {
    expect(expectedGain(4, 10)).toBe(0)
  })
})

describe('projection (§ 5)', () => {
  it('vaut l’équivalence du jour quand rien ne la corrige', () => {
    const projection = project({ ...BASE, weeksToRace: 0 })
    expect(projection.timeS).toBe(Math.round(raceTimeForVdot(BASE.vdot, SEMI_M)))
  })

  it('ajoute une demi-seconde par mètre de dénivelé', () => {
    const flat = project({ ...BASE, weeksToRace: 0 })
    const hilly = project({ ...BASE, weeksToRace: 0, elevationGainM: 300 })
    expect(hilly.timeS - flat.timeS).toBe(150)
  })

  it('ajoute 1,5 % par degré au-dessus de 18 °C', () => {
    const mild = project({ ...BASE, weeksToRace: 0 })
    const hot = project({ ...BASE, weeksToRace: 0, expectedTempC: 24 })
    expect((hot.timeS - mild.timeS) / mild.timeS).toBeCloseTo(0.09, 3)
  })

  it('ne corrige rien en dessous du seuil de chaleur', () => {
    const mild = project({ ...BASE, weeksToRace: 0 })
    const cool = project({ ...BASE, weeksToRace: 0, expectedTempC: 12 })
    expect(cool.timeS).toBe(mild.timeS)
  })

  it('projette plus vite quand la course est loin', () => {
    const near = project({ ...BASE, weeksToRace: 1 })
    const far = project({ ...BASE, weeksToRace: 24 })
    expect(far.timeS).toBeLessThan(near.timeS)
    expect(far.vdot).toBeGreaterThan(near.vdot)
  })
})

describe('intervalle (§ 5)', () => {
  it('reste entre 1 et 5 % du temps projeté', () => {
    for (const history of [[], [33.15], [33.15, 33.75], [30, 40, 33]]) {
      const projection = project({ ...BASE, testHistory: history, weeksToRace: 4 })
      // Les bornes se comparent en secondes : le temps est arrondi à l'unité.
      const half = projection.highS - projection.timeS
      expect(half).toBeGreaterThanOrEqual(Math.floor(projection.timeS * MIN_INTERVAL_SHARE))
      expect(half).toBeLessThanOrEqual(Math.ceil(projection.timeS * MAX_INTERVAL_SHARE))
    }
  })

  it('prend la borne haute sur un plancher de forme, la basse sur une mesure', () => {
    const floor = intervalS(7200, 33, SEMI_M, [], true)
    const measured = intervalS(7200, 33, SEMI_M, [], false)

    expect(floor).toBeCloseTo(7200 * MAX_INTERVAL_SHARE, 6)
    expect(measured).toBeCloseTo(7200 * MIN_INTERVAL_SHARE, 6)
  })

  it('n’a pas d’écart-type avec moins de deux tests', () => {
    expect(testVariability([])).toBeUndefined()
    expect(testVariability([33])).toBeUndefined()
    expect(testVariability([33, 34])).toBeCloseTo(0, 6)
  })

  it('s’élargit quand les tests sautent dans tous les sens', () => {
    const steady = project({ ...BASE, testHistory: [33, 33.6, 34.2], weeksToRace: 4 })
    const erratic = project({ ...BASE, testHistory: [33, 38, 31], weeksToRace: 4 })

    expect(erratic.highS - erratic.timeS).toBeGreaterThan(steady.highS - steady.timeS)
  })
})

describe('confiance (§ 5)', () => {
  const projection = project({ ...BASE, weeksToRace: 4 })

  it('donne 50 % quand l’objectif est la projection', () => {
    expect(confidence(projection, { targetS: projection.timeS })).toBe(50)
  })

  it('donne 98 % à la borne haute et 2 % à la borne basse', () => {
    expect(confidence(projection, { targetS: projection.highS })).toBe(98)
    expect(confidence(projection, { targetS: projection.lowS })).toBe(2)
  })

  it('est nulle sans objectif ni référence', () => {
    expect(confidence(projection, { targetS: null })).toBeNull()
  })

  it('ne dépasse jamais ses propres bornes : ni 0 %, ni 100 %', () => {
    expect(confidence(projection, { targetS: 1 })).toBe(2)
    expect(confidence(projection, { targetS: 99_999 })).toBe(98)
  })

  it('monte quand l’objectif se relâche', () => {
    const tight = confidence(projection, { targetS: projection.timeS - 120 })!
    const loose = confidence(projection, { targetS: projection.timeS + 120 })!
    expect(loose).toBeGreaterThan(tight)
  })
})
