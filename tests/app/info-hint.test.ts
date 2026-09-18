import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import InfoHint from '~/components/ui/InfoHint.vue'
import { GLOSSARY } from '~/utils/glossary'

/**
 * La bulle est posée sur le `body` pour ne jamais être rognée par un dialog qui
 * défile : on la retrouve par l'`aria-describedby` de son propre déclencheur.
 */
function bubbleOf(trigger: { attributes: (name: string) => string | undefined }) {
  const id = trigger.attributes('aria-describedby')
  return id === undefined ? null : document.getElementById(id)
}

describe('bulle d’explication (§ 11, P5.13)', () => {
  it('reste fermée tant que rien ne la vise', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'vdot' } })
    expect(bubbleOf(hint.get('[role="button"]'))).toBeNull()
  })

  it('s’ouvre au focus clavier et décrit le libellé', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'vdot' } })
    await hint.get('[role="button"]').trigger('focus')
    await nextTick()

    expect(bubbleOf(hint.get('[role="button"]'))?.textContent).toContain(GLOSSARY.vdot.text)
  })

  it('se referme sur Échap', async () => {
    const hint = await mountSuspended(InfoHint, { props: { term: 'rpe' } })
    await hint.get('[role="button"]').trigger('focus')
    await nextTick()
    expect(bubbleOf(hint.get('[role="button"]'))).not.toBeNull()

    await hint.get('[role="button"]').trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(bubbleOf(hint.get('[role="button"]'))).toBeNull()
  })
})
