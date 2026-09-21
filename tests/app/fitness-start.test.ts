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

  it('lit le chrono d’un seul champ : trois nombres font des heures', () => {
    const at = (text: string) => chronoSeconds({ ...BLANK, chrono: text })

    expect(at('1:42:17')).toBe(3600 + 42 * 60 + 17)
    expect(at('1h42:17')).toBe(3600 + 42 * 60 + 17)
    expect(at(' 2.05.00 ')).toBe(2 * 3600 + 5 * 60)
  })

  it('lit deux nombres comme des minutes et des secondes', () => {
    const at = (text: string) => chronoSeconds({ ...BLANK, chrono: text })

    expect(at('47:20')).toBe(47 * 60 + 20)
    expect(at('112:30')).toBe(112 * 60 + 30)
  })

  it('refuse un chrono illisible, nul ou aux minutes impossibles', () => {
    const at = (text: string) => chronoSeconds({ ...BLANK, chrono: text })

    expect(at('')).toBeNull()
    expect(at('4720')).toBeNull()
    expect(at('47:75')).toBeNull()
    expect(at('1:75:00')).toBeNull()
    expect(at('0:00')).toBeNull()
  })

  it('refuse un chrono vide et accepte un chrono daté', () => {
    const empty = { ...BLANK, kind: FitnessDeclaration.Chrono }
    expect(fitnessStartIsAnswered(empty)).toBe(false)

    const filled = { ...empty, chrono: '56:40', date: '2026-06-21' }
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
