import { describe, expect, it } from 'vitest'
import { PERIODS, windowStart } from '~~/server/domain/shared/period'

/**
 * La fenêtre de lecture de Progression (§ 9, P6). Le piège est consigné dans le
 * plan : `'0000-01-01'` fait échouer la requête Postgres, l'année zéro n'existe
 * pas. La borne « tout » remonte donc à 1970.
 */
describe('fenêtre de lecture de Progression', () => {
  it('donne huit semaines au bloc et six mois à la saison', () => {
    expect(PERIODS.bloc).toBe(56)
    expect(PERIODS.saison).toBe(182)
    expect(PERIODS.tout).toBeNull()
  })

  it('recule d’autant de jours que la fenêtre en compte', () => {
    expect(windowStart('2026-11-22', 'bloc')).toBe('2026-09-27')
    expect(windowStart('2026-11-22', 'saison')).toBe('2026-05-24')
  })

  it('remonte à une date que Postgres accepte pour « tout »', () => {
    const start = windowStart('2026-11-22', 'tout')

    expect(start).toBe('1970-01-01')
    expect(Number(start.slice(0, 4))).toBeGreaterThan(0)
  })
})
