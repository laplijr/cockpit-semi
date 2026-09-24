import { describe, expect, it } from 'vitest'
import { EXPLOSIVE_S, tempoPhases, tempoProgress, tempoWords } from '~/utils/tempo'

/** Le tempo prescrit, joué par la figure et dit en mots (P25). */
describe('tempo', () => {
  it('lit les quatre temps, X valant 0,6 s', () => {
    expect(tempoPhases('2-0-X-0')).toEqual([2, 0, EXPLOSIVE_S, 0])
    expect(tempoPhases('3-1-2-0')).toEqual([3, 1, 2, 0])
  })

  it('joue 1,5 s par sens sans tempo prescrit', () => {
    expect(tempoPhases(undefined)).toEqual([1.5, 0, 1.5, 0])
  })

  it('dit le tempo en mots', () => {
    expect(tempoWords('2-0-X-0')).toBe('descente 2″, remontée explosive')
    expect(tempoWords('3-1-2-0')).toBe('descente 3″, pause 1″ en bas, remontée 2″')
    expect(tempoWords(undefined)).toBeNull()
  })

  it('arrive en bas au bout de la descente et y reste le temps de la pause', () => {
    const phases = tempoPhases('3-1-2-0')
    expect(tempoProgress(phases, 0)).toBe(0)
    expect(tempoProgress(phases, 3)).toBe(1)
    expect(tempoProgress(phases, 3.5)).toBe(1)
    expect(tempoProgress(phases, 6.01)).toBeCloseTo(0, 1)
  })
})
