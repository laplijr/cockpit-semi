import { describe, expect, it } from 'vitest'
import { Sensation } from '~~/server/domain/load/feedback'
import {
  CAUTION_THRESHOLD,
  READY_THRESHOLD,
  ReadinessState,
  readiness,
} from '~~/server/domain/readiness/readiness'

const neutral = {
  sleepHours: 8,
  rpeDeltas: [0, 0, 0],
  sensations: [Sensation.Easy],
  loadRatio: 1,
}

describe('forme du jour', () => {
  it('donne un score maximal quand tout va bien', () => {
    const result = readiness(neutral)
    expect(result.score).toBe(100)
    expect(result.state).toBe(ReadinessState.Ready)
    expect(result.causes).toEqual([])
  })

  it('classe en vigilance entre 40 et 64', () => {
    const result = readiness({
      ...neutral,
      sleepHours: 6,
      rpeDeltas: [1, 1, 1],
      sensations: [Sensation.HeavyLegs],
    })
    expect(result.score).toBeGreaterThanOrEqual(CAUTION_THRESHOLD)
    expect(result.score).toBeLessThan(READY_THRESHOLD)
    expect(result.state).toBe(ReadinessState.Caution)
  })

  it('classe en repos sous 40', () => {
    const result = readiness({
      sleepHours: 4,
      rpeDeltas: [2, 2, 2],
      sensations: [Sensation.HeavyLegs, Sensation.Stiff],
      loadRatio: 2,
    })
    expect(result.score).toBeLessThan(CAUTION_THRESHOLD)
    expect(result.state).toBe(ReadinessState.Rest)
  })

  it('reste au milieu quand rien n’est saisi, sans punir l’absence de données', () => {
    const result = readiness({ sleepHours: null, rpeDeltas: [], sensations: [], loadRatio: null })
    expect(result.score).toBe(50)
    expect(result.state).toBe(ReadinessState.Caution)
  })

  it('nomme les causes qui tirent le score vers le bas', () => {
    const result = readiness({ ...neutral, sleepHours: 5, loadRatio: 1.8 })
    expect(result.causes).toContain('Nuit de 5 h')
    expect(result.causes.some((cause) => cause.startsWith('Charge hors zone'))).toBe(true)
  })

  it('ne signale pas la charge quand elle est dans la zone de référence', () => {
    expect(readiness({ ...neutral, loadRatio: 1.1 }).causes).toEqual([])
  })

  it('propose un texte différent par état', () => {
    const suggestions = new Set(
      [
        readiness(neutral),
        readiness({ ...neutral, sleepHours: 6, rpeDeltas: [1, 1, 1] }),
        readiness({ sleepHours: 4, rpeDeltas: [3], sensations: [Sensation.Stiff], loadRatio: 2 }),
      ].map((item) => item.suggestion),
    )
    expect(suggestions.size).toBe(3)
  })

  it('pondère le sommeil plus fort que la charge', () => {
    const badSleep = readiness({ ...neutral, sleepHours: 5 })
    const badLoad = readiness({ ...neutral, loadRatio: 2 })
    expect(badSleep.score).toBeLessThan(badLoad.score)
  })
})
