import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, navItemFor } from '~/utils/navigation'

describe('carte de navigation', () => {
  it('expose les quatre groupes du cockpit dans l’ordre de lecture', () => {
    expect(NAV_GROUPS.map((group) => group.title)).toEqual([
      'Piloter',
      'Planifier',
      'Comprendre',
      'Réglages',
    ])
  })

  it('n’associe jamais deux entrées à la même route', () => {
    const paths = NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('retrouve l’entrée correspondant à une route connue', () => {
    expect(navItemFor('/semaine')?.label).toBe('Semaine')
  })

  it('ne retourne rien pour une route hors navigation', () => {
    expect(navItemFor('/login')).toBeUndefined()
  })
})
