import { describe, expect, it } from 'vitest'
import { formatSeconds } from '~/utils/format'

describe('une durée d’étape au format de la montre (P19)', () => {
  it('écrit les secondes sous la minute', () => {
    expect(formatSeconds(45)).toBe('45″')
  })

  it('n’écrit pas de zéro inutile sur une minute ronde', () => {
    expect(formatSeconds(60)).toBe('1′')
    expect(formatSeconds(180)).toBe('3′')
  })

  it('garde les secondes au lieu d’arrondir à la minute', () => {
    expect(formatSeconds(90)).toBe('1′30')
    expect(formatSeconds(150)).toBe('2′30')
  })
})
