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
    title: 'Planifier',
    items: [
      { label: 'Courses', to: '/courses', icon: 'flag', phase: 'P1' },
      { label: 'Muscu', to: '/muscu', icon: 'muscu', phase: 'P4' },
      { label: 'Vélo', to: '/velo', icon: 'velo', phase: 'P4' },
      { label: 'Nutrition', to: '/nutrition', icon: 'nutri', phase: 'P6' },
    ],
  },
  {
    title: 'Comprendre',
    items: [
      { label: 'Historique', to: '/historique', icon: 'hist', phase: 'P7' },
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

const BY_PATH = new Map(NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.to, item]))

export function navItemFor(path: string): NavItem | undefined {
  return BY_PATH.get(path)
}
