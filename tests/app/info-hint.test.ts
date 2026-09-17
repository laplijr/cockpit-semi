import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import InfoHint from '~/components/ui/InfoHint.vue'
import { GLOSSARY } from '~/utils/glossary'

describe('bulle d’explication (§ 11, P5.13)', () => {
  it('reste fermée tant que rien ne la vise', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'vdot' } })
    expect(hint.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('s’ouvre au focus clavier et décrit le libellé', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'vdot' } })
    await hint.get('button').trigger('focus')
    await nextTick()

    const bubble = hint.get('[role="tooltip"]')
    expect(bubble.text()).toContain(GLOSSARY.vdot.text)
    expect(hint.get('button').attributes('aria-describedby')).toBe(bubble.attributes('id'))
  })

  it('se referme sur Échap', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'rpe' } })
    await hint.get('button').trigger('focus')
    await nextTick()
    await hint.get('button').trigger('keydown', { key: 'Escape' })

    expect(hint.find('[role="tooltip"]').exists()).toBe(false)
  })
})
