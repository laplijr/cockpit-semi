import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import DecisionList from '~/components/cockpit/DecisionList.vue'
import RaceDial from '~/components/cockpit/RaceDial.vue'
import Skeleton from '~/components/ui/Skeleton.vue'
import { usePropositionsStore } from '~/stores/proposals'

describe('squelette de chargement (§ 8, P5.20)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('occupe la hauteur exacte demandée, pour que rien ne bouge à l’arrivée', async () => {
    const skeleton = await mountSuspended(Skeleton, { props: { variant: 'number' } })
    expect(skeleton.get('span').attributes('style')).toContain('height: 44px')
  })

  it('est invisible aux lecteurs d’écran : il ne dit rien du contenu', async () => {
    const skeleton = await mountSuspended(Skeleton)
    expect(skeleton.get('span').attributes('aria-hidden')).toBe('true')
  })

  it('garde le titre du cadran et ne montre aucun chiffre tant que la donnée manque', async () => {
    const dial = await mountSuspended(RaceDial, { props: { today: '2026-11-22', loading: true } })

    expect(dial.text()).toContain('Course A')
    expect(dial.text()).not.toContain('J−')
    expect(dial.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('remplace « Rien à décider » par un squelette tant que les décisions n’ont pas répondu', async () => {
    const list = await mountSuspended(DecisionList, { props: { limit: 3 } })
    const proposals = usePropositionsStore()

    expect(proposals.loaded).toBe(false)
    expect(list.text()).not.toContain('Rien à décider')

    proposals.loaded = true
    await nextTick()

    expect(list.text()).toContain('Rien à décider')
  })
})
