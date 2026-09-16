import { describe, expect, it } from 'vitest'
import { createClock, fixedClock } from '~~/server/domain/shared/clock'

describe('horloge du cockpit', () => {
  it('retourne la date forcée quand elle est définie', () => {
    expect(createClock('2026-11-22').today()).toBe('2026-11-22')
  })

  it('retourne la date réelle sans date forcée', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(createClock().today()).toBe(today)
    expect(createClock(null).today()).toBe(today)
    expect(createClock('').today()).toBe(today)
  })

  it('refuse une date mal formée plutôt que de l’ignorer', () => {
    expect(() => createClock('22/11/2026')).toThrow()
    expect(() => createClock('demain')).toThrow()
  })

  it('fige la date pour les rejeux de scénario', () => {
    const clock = fixedClock('2027-03-07')
    expect(clock.today()).toBe('2027-03-07')
    expect(clock.today()).toBe('2027-03-07')
  })
})
