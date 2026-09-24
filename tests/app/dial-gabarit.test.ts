import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import RaceDial from '~/components/cockpit/RaceDial.vue'

/**
 * Un cadran sans mesure montre son gabarit au lieu de se réduire (§ 8, P5.21) :
 * la classe `dial` lui donne le plancher de hauteur, le tiret et l'échelle en
 * creux disent qu'il y a une mesure à venir. Depuis P6.35 le gabarit se réduit
 * à quatre lignes — label, chiffre à 56 px, une métadonnée `mono`, échelle —
 * et le cadran qui s'ouvre est un vrai bouton.
 */
describe('cadran à vide', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const raceDial = () => mountSuspended(RaceDial, { props: { today: '2026-11-22' } })

  it('garde le plancher de hauteur d’un cadran', async () => {
    expect((await raceDial()).get('div').classes()).toContain('dial')
  })

  it('met un tiret à la place du grand chiffre', async () => {
    expect((await raceDial()).get('.display').text()).toBe('—')
  })

  it('garde son échelle, en creux', async () => {
    expect((await raceDial()).find('.bg-accent-track').exists()).toBe(true)
  })

  it('renvoie vers Courses plutôt que d’ouvrir un détail qui n’existe pas', async () => {
    expect((await raceDial()).get('a').attributes('href')).toBe('/courses')
  })
})

describe('gabarit de cadran (§ 8, P6.35)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const race = {
    id: 1,
    name: 'Paris',
    date: '2027-03-07',
    distanceM: 21097.5,
    priority: 'A',
    objectiveMode: 'trois_niveaux',
    objectifS: 6300,
    recordS: null,
    projectionS: 6480,
    projectionLowS: 6360,
    projectionHighS: 6600,
    projectionIsFloor: false,
    gapS: 180,
    confidencePct: 41,
    objectiveToSet: false,
  }

  const dial = () => mountSuspended(RaceDial, { props: { race, today: '2026-11-22' } })

  it('ouvre depuis un vrai bouton, pas depuis une div', async () => {
    const mounted = await dial()

    expect(mounted.get('button.dial').exists()).toBe(true)
    expect(mounted.find('div[role="button"]').exists()).toBe(false)
  })

  it('porte le chiffre à 56 px, 38 au pouce', async () => {
    const classes = (await dial()).get('.display').classes()
    expect(classes).toContain('lean:text-display-xl')
    expect(classes).toContain('text-display-l')
  })

  it('n’affiche qu’une métadonnée mono sous le chiffre', async () => {
    expect((await dial()).findAll('button.dial > .mono')).toHaveLength(1)
  })

  it('n’affiche plus de pastille : la confiance est l’échelle', async () => {
    expect((await dial()).find('.pill').exists()).toBe(false)
  })
})
