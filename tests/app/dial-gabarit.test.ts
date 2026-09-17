import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import RaceDial from '~/components/cockpit/RaceDial.vue'

/**
 * Un cadran sans mesure montre son gabarit au lieu de se réduire (§ 8, P5.21) :
 * la classe `dial` lui donne le plancher de hauteur, le tiret et l'échelle en
 * creux disent qu'il y a une mesure à venir.
 */
describe('cadran à vide', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('garde le plancher de hauteur d’un cadran', async () => {
    const dial = await mountSuspended(RaceDial, { props: { today: '2026-11-22' } })
    expect(dial.get('div').classes()).toContain('dial')
  })

  it('met un tiret à la place du grand chiffre', async () => {
    const dial = await mountSuspended(RaceDial, { props: { today: '2026-11-22' } })
    expect(dial.get('.display').text()).toBe('—')
  })

  it('garde son échelle, en creux', async () => {
    const dial = await mountSuspended(RaceDial, { props: { today: '2026-11-22' } })
    expect(dial.find('.bg-accent-track').exists()).toBe(true)
  })

  it('renvoie vers Courses plutôt que d’ouvrir un détail qui n’existe pas', async () => {
    const dial = await mountSuspended(RaceDial, { props: { today: '2026-11-22' } })
    expect(dial.get('a').attributes('href')).toBe('/courses')
  })
})
