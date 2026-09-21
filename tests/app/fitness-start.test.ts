import { describe, expect, it } from 'vitest'
import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'
import {
  MAX_EASY_PACE_S,
  MIN_EASY_PACE_S,
  chronoSeconds,
  easyPaceSeconds,
  emptyFitnessStart,
  fitnessStartBody,
  fitnessStartIsAnswered,
} from '~/utils/fitness-start'

const BLANK = emptyFitnessStart('2026-09-16')

describe('saisie du niveau de course (§ 9, P8.2)', () => {
  it('part sur « je ne sais pas », qui est déjà une réponse complète', () => {
    expect(BLANK.kind).toBe(FitnessDeclaration.Unknown)
    expect(fitnessStartIsAnswered(BLANK)).toBe(true)
    expect(fitnessStartBody(BLANK)).toEqual({ kind: FitnessDeclaration.Unknown })
  })

  it('compose le chrono à partir des trois champs', () => {
    const value = { ...BLANK, hours: 1, minutes: 42, seconds: 17 }
    expect(chronoSeconds(value)).toBe(3600 + 42 * 60 + 17)
  })

  it('refuse un chrono vide et accepte un chrono daté', () => {
    const empty = { ...BLANK, kind: FitnessDeclaration.Chrono }
    expect(fitnessStartIsAnswered(empty)).toBe(false)

    const filled = { ...empty, minutes: 56, seconds: 40, date: '2026-06-21' }
    expect(fitnessStartIsAnswered(filled)).toBe(true)
    expect(fitnessStartBody(filled)).toEqual({
      kind: FitnessDeclaration.Chrono,
      distanceM: 10_000,
      timeS: 56 * 60 + 40,
      date: '2026-06-21',
    })
  })

  it('lit l’allure d’un seul champ, quel que soit le séparateur tapé', () => {
    const pace = (text: string) =>
      easyPaceSeconds({ ...BLANK, kind: FitnessDeclaration.EasyPace, pace: text })

    expect(pace('6:47')).toBe(6 * 60 + 47)
    expect(pace(" 6'47 ")).toBe(6 * 60 + 47)
    expect(pace('6.47')).toBe(6 * 60 + 47)
    expect(pace('6,05')).toBe(6 * 60 + 5)
  })

  it('refuse une allure illisible plutôt que d’en deviner une', () => {
    const pace = (text: string) =>
      easyPaceSeconds({ ...BLANK, kind: FitnessDeclaration.EasyPace, pace: text })

    expect(pace('')).toBeNull()
    expect(pace('647')).toBeNull()
    expect(pace('6:75')).toBeNull()
  })

  it('borne l’allure déclarée aux mêmes valeurs que la route', () => {
    const at = (text: string) => ({ ...BLANK, kind: FitnessDeclaration.EasyPace, pace: text })

    expect(easyPaceSeconds(at('16:00'))!).toBeGreaterThan(MAX_EASY_PACE_S)
    expect(easyPaceSeconds(at('2:00'))!).toBeLessThan(MIN_EASY_PACE_S)
    expect(fitnessStartIsAnswered(at('16:00'))).toBe(false)
    expect(fitnessStartIsAnswered(at('2:00'))).toBe(false)
    expect(fitnessStartIsAnswered(at('6:47'))).toBe(true)
    expect(fitnessStartBody(at('6:47'))).toEqual({
      kind: FitnessDeclaration.EasyPace,
      paceSecPerKm: 6 * 60 + 47,
    })
  })
})
