import { describe, expect, it } from 'vitest'
import { Sport } from '~~/server/domain/shared/sport'
import {
  BOTTOM_BAR_ITEMS,
  MORE_GROUPS,
  NAV_GROUPS,
  moreGroupsFor,
  navGroupsFor,
  navItemFor,
} from '~/utils/navigation'

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

describe('navigation selon les sports déclarés (§ 9, P8.2)', () => {
  const pathsOf = (groups: ReturnType<typeof navGroupsFor>) =>
    groups.flatMap((group) => group.items).map((item) => item.to)

  it('ne retire rien quand aucun sport n’est déclaré : le cockpit de Ronan ne bouge pas', () => {
    expect(navGroupsFor(undefined)).toBe(NAV_GROUPS)
  })

  it('cache Renforcement et Vélo quand seule la course est déclarée', () => {
    const paths = pathsOf(navGroupsFor([Sport.Running]))
    expect(paths).not.toContain('/renforcement')
    expect(paths).not.toContain('/velo')
    expect(paths).toContain('/course-a-pied')
    expect(paths).toContain('/nutrition')
  })

  it('ne cache que le sport absent', () => {
    const paths = pathsOf(navGroupsFor([Sport.Running, Sport.Strength]))
    expect(paths).toContain('/renforcement')
    expect(paths).not.toContain('/velo')
  })

  it('garde les trois sports quand ils sont tous déclarés', () => {
    const declared = navGroupsFor([Sport.Running, Sport.Cycling, Sport.Strength])
    expect(pathsOf(declared)).toEqual(pathsOf(NAV_GROUPS))
  })

  it('ne touche à aucun groupe hors bibliothèques', () => {
    const titles = navGroupsFor([Sport.Running]).map((group) => group.title)
    expect(titles).toEqual(NAV_GROUPS.map((group) => group.title))
  })

  it('applique le même filtre à la feuille « Plus » du téléphone', () => {
    expect(moreGroupsFor(undefined).map((group) => group.title)).toEqual(
      MORE_GROUPS.map((group) => group.title),
    )
    expect(pathsOf(moreGroupsFor([Sport.Running]))).not.toContain('/velo')
    expect(pathsOf(moreGroupsFor([Sport.Running]))).not.toContain(BOTTOM_BAR_ITEMS[0]!.to)
  })
})
