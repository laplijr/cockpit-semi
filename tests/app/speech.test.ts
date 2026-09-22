import { describe, expect, it } from 'vitest'
import { speakDistance, speakDuration, speakPace } from '~/utils/format'

describe('ce qui part à la voix (§ 9, P18)', () => {
  it('dit des minutes là où l’écran écrit deux points', () => {
    expect(speakDuration(345)).toBe('5 minutes 45 secondes')
    expect(speakPace(345)).toBe('5 minutes 45 secondes au kilomètre')
  })

  it('ne dit pas les zéros', () => {
    expect(speakDuration(180)).toBe('3 minutes')
    expect(speakDuration(3600)).toBe('1 heure')
    expect(speakDuration(0)).toBe('0 seconde')
  })

  it('accorde le pluriel', () => {
    expect(speakDuration(61)).toBe('1 minute 1 seconde')
    expect(speakDuration(7325)).toBe('2 heures 2 minutes 5 secondes')
  })

  it('dit la virgule d’une distance, et les mètres sous le kilomètre', () => {
    expect(speakDistance(2500)).toBe('2 virgule 5 kilomètres')
    expect(speakDistance(12000)).toBe('12 kilomètres')
    expect(speakDistance(400)).toBe('400 mètres')
    expect(speakDistance(1000)).toBe('1 kilomètre')
    expect(speakDistance(1500)).toBe('1 virgule 5 kilomètre')
  })

  it('ne dit rien quand il n’y a rien à dire', () => {
    expect(speakDuration(null)).toBe('')
    expect(speakPace(undefined)).toBe('')
    expect(speakDistance(null)).toBe('')
  })
})
