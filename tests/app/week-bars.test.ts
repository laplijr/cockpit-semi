import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WeekBars, { type WeekBar } from '~/components/ui/WeekBars.vue'

const weeks: WeekBar[] = [
  {
    index: 1,
    startDate: '2026-11-16',
    endDate: '2026-11-22',
    phaseType: 'developpement',
    targetRunM: 32000,
    light: false,
    test: false,
    comebackRatio: null,
    loadUa: 420,
  },
]

/**
 * La légende des deux étages est l'axe du tracé, pas un paragraphe sous la tuile
 * (§ 8, P6.35). La frise de la page Courses n'en porte pas : elle se lit seule.
 */
describe('barres de semaine', () => {
  it('nomme ses deux étages quand on lui donne une légende', async () => {
    const mounted = await mountSuspended(WeekBars, {
      props: { weeks, legend: { volume: 'volume visé', load: 'charge enregistrée' } },
    })

    expect(mounted.text()).toContain('volume visé')
    expect(mounted.text()).toContain('charge enregistrée')
  })

  it('reste muet sans légende', async () => {
    const mounted = await mountSuspended(WeekBars, { props: { weeks } })

    expect(mounted.text()).not.toContain('volume visé')
  })
})
