import { describe, expect, it } from 'vitest'
import { BOTTOM_BAR_ITEMS, MORE_GROUPS, NAV_GROUPS, navItemFor } from '~/utils/navigation'

describe('carte de navigation', () => {
  it('expose les cinq groupes du cockpit dans l’ordre de lecture', () => {
    expect(NAV_GROUPS.map((group) => group.title)).toEqual([
      'Piloter',
      'Objectifs',
      'Bibliothèques',
      'Comprendre',
      'Réglages',
    ])
  })

  it('ne met que Courses dans Objectifs : c’est la seule entrée qui pilote le plan', () => {
    const objectifs = NAV_GROUPS.find((group) => group.title === 'Objectifs')
    expect(objectifs?.items.map((item) => item.to)).toEqual(['/courses'])
  })

  it('regroupe les quatre bibliothèques', () => {
    const libs = NAV_GROUPS.find((group) => group.title === 'Bibliothèques')
    expect(libs?.items.map((item) => item.to)).toEqual([
      '/course-a-pied',
      '/renforcement',
      '/velo',
      '/nutrition',
    ])
  })

  it('n’associe jamais deux entrées à la même route', () => {
    const paths = NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('retrouve l’entrée correspondant à une route connue', () => {
    expect(navItemFor('/progression')?.label).toBe('Progression')
    expect(navItemFor('/course-a-pied')?.label).toBe('Course à pied')
  })

  it('ne retourne rien pour une route hors navigation', () => {
    expect(navItemFor('/historique')).toBeUndefined()
    expect(navItemFor('/login')).toBeUndefined()
  })
})

describe('partition de la navigation du téléphone', () => {
  it('met les trois destinations de la boucle quotidienne dans la barre du bas', () => {
    expect(BOTTOM_BAR_ITEMS.map((item) => item.to)).toEqual(['/', '/semaine', '/propositions'])
  })

  it('laisse les quatre autres groupes à la feuille « Plus », dans l’ordre de lecture', () => {
    expect(MORE_GROUPS.map((group) => group.title)).toEqual([
      'Objectifs',
      'Bibliothèques',
      'Comprendre',
      'Réglages',
    ])
  })

  it('ne perd ni ne duplique aucune entrée : la partition couvre NAV_GROUPS', () => {
    const partitioned = [...BOTTOM_BAR_ITEMS, ...MORE_GROUPS.flatMap((group) => group.items)].map(
      (item) => item.to,
    )

    expect(partitioned.sort()).toEqual(
      NAV_GROUPS.flatMap((group) => group.items)
        .map((item) => item.to)
        .sort(),
    )
  })

  it('laisse la place du quatrième onglet à la porte « Plus »', () => {
    expect(BOTTOM_BAR_ITEMS).toHaveLength(3)
  })
})
