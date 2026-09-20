import type { IconName } from '~/components/ui/AppIcon.vue'

export interface NavItem {
  label: string
  to: string
  icon: IconName
  /** Phase du plan qui livre le contenu de cette page. */
  phase: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Piloter',
    items: [
      { label: 'Cockpit', to: '/', icon: 'gauge', phase: 'P1' },
      { label: 'Semaine', to: '/semaine', icon: 'week', phase: 'P1' },
      { label: 'Propositions', to: '/propositions', icon: 'props', phase: 'P3' },
    ],
  },
  {
    title: 'Objectifs',
    items: [{ label: 'Courses', to: '/courses', icon: 'flag', phase: 'P1' }],
  },
  {
    title: 'Bibliothèques',
    items: [
      { label: 'Course à pied', to: '/course-a-pied', icon: 'run', phase: 'P1' },
      { label: 'Renforcement', to: '/renforcement', icon: 'muscu', phase: 'P4' },
      { label: 'Vélo', to: '/velo', icon: 'velo', phase: 'P4' },
      { label: 'Nutrition', to: '/nutrition', icon: 'nutri', phase: 'P6' },
    ],
  },
  {
    title: 'Comprendre',
    items: [
      { label: 'Progression', to: '/progression', icon: 'hist', phase: 'P3' },
      { label: 'Apprentissage', to: '/apprentissage', icon: 'learn', phase: 'P6' },
    ],
  },
  {
    title: 'Réglages',
    items: [
      { label: 'Connexions', to: '/connexions', icon: 'plug', phase: 'P2' },
      { label: 'Profil', to: '/profil', icon: 'user', phase: 'P1' },
    ],
  },
]

/**
 * Sur téléphone la navigation est une barre du bas à quatre onglets : les
 * trois destinations du groupe « Piloter » — la boucle qu'on revisite dix fois
 * par semaine — plus une porte « Plus » vers tout le reste (§ 8). Les deux
 * listes se déduisent de `NAV_GROUPS` : il n'y a jamais deux listes à tenir.
 */
const BOTTOM_BAR_GROUP = 'Piloter'

export const BOTTOM_BAR_ITEMS: NavItem[] = NAV_GROUPS.filter(
  (group) => group.title === BOTTOM_BAR_GROUP,
).flatMap((group) => group.items)

export const MORE_GROUPS: NavGroup[] = NAV_GROUPS.filter(
  (group) => group.title !== BOTTOM_BAR_GROUP,
)

const BY_PATH = new Map(NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.to, item]))

export function navItemFor(path: string): NavItem | undefined {
  return BY_PATH.get(path)
}
