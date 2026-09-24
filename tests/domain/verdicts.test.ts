import { describe, expect, it } from 'vitest'
import { fitnessVerdict } from '~~/server/domain/fitness/current'
import { projectionVerdict } from '~~/server/domain/fitness/objective'
import { Sensation } from '~~/server/domain/load/feedback'
import { loadVerdict } from '~~/server/domain/load/load'
import { readiness } from '~~/server/domain/readiness/readiness'
import { frenchSignedDecimal, frenchSignedDuration } from '~~/server/domain/shared/french'

/**
 * Chaque cadran porte un verdict en mots (P20) : le chiffre juste ne dit pas
 * toujours ce qu'il veut dire. Le mot vient du domaine, jamais du front.
 */
describe('verdicts des cadrans', () => {
  it('nomme la forme du jour par son état', () => {
    const neutral = { rpeDeltas: [0, 0, 0], sensations: [Sensation.Easy], loadRatio: 1 }
    expect(readiness({ ...neutral, sleepHours: 8 }).verdict).toBe('prêt')
    expect(
      readiness({ sleepHours: 4, rpeDeltas: [2, 2, 2], sensations: [], loadRatio: 2 }).verdict,
    ).toBe('repos')
  })

  it('dit la charge en mots de coureur, aux bornes de la bande', () => {
    expect(loadVerdict(0.55)).toBe('charge basse')
    expect(loadVerdict(0.8)).toBe('charge tenue')
    expect(loadVerdict(1.3)).toBe('charge tenue')
    expect(loadVerdict(1.31)).toBe('charge haute')
  })

  it('donne la nature du point de forme puis son écart au précédent', () => {
    const points = [
      { date: '2026-09-13', vdot: 33.15, isFloor: true },
      { date: '2026-10-20', vdot: 33.75, isFloor: false },
    ]
    expect(fitnessVerdict(points, points[1]!)).toBe('mesuré · +0,6')
    expect(fitnessVerdict(points, points[0]!)).toBe('plancher')
  })

  it('dit l’écart de la projection à sa cible, signé', () => {
    expect(projectionVerdict(45, 'objectif')).toBe("projection +0:45 sur l'objectif")
    expect(projectionVerdict(-80, 'record')).toBe('projection −1:20 sur le record')
    expect(projectionVerdict(0.2, 'objectif')).toBe("projection sur l'objectif")
  })

  it('écrit les écarts signés à la française', () => {
    expect(frenchSignedDecimal(-0.3, 1)).toBe('−0,3')
    expect(frenchSignedDecimal(0.04, 1)).toBe('0,0')
    expect(frenchSignedDuration(3723)).toBe('+1:02:03')
  })
})
