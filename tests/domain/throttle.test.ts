import { describe, expect, it } from 'vitest'
import {
  LOGIN_WINDOW_MS,
  MAX_LOGIN_FAILURES,
  lockMessage,
  lockedMinutes,
  windowCutoff,
} from '~~/server/domain/account/throttle'

const now = new Date('2026-11-24T10:00:00Z')

describe('limite de tentatives de connexion (P28)', () => {
  it('juge les cinq premières tentatives de la fenêtre', () => {
    expect(lockedMinutes({ failures: MAX_LOGIN_FAILURES, windowStart: now }, now)).toBeNull()
  })

  it('ferme la sixième, jusqu’à la fin de la fenêtre', () => {
    const windowStart = new Date(now.getTime() - 4 * 60_000)
    expect(lockedMinutes({ failures: MAX_LOGIN_FAILURES + 1, windowStart }, now)).toBe(11)
  })

  it('ne rend jamais zéro minute à qui est encore fermé', () => {
    const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS + 5_000)
    expect(lockedMinutes({ failures: 9, windowStart }, now)).toBe(1)
  })

  it('fait repartir une fenêtre échue', () => {
    expect(windowCutoff(now).getTime()).toBe(now.getTime() - LOGIN_WINDOW_MS)
  })

  it('dit quand réessayer', () => {
    expect(lockMessage(1)).toBe('Trop de tentatives. Réessaie dans 1 minute.')
    expect(lockMessage(11)).toBe('Trop de tentatives. Réessaie dans 11 minutes.')
  })
})
