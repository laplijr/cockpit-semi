import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HoverBubble from '~/components/ui/HoverBubble.vue'
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

const hint = (term: 'vdot' | 'rpe') =>
  mountSuspended(InfoHint, { props: { term }, slots: { default: () => 'Forme mesurée' } })

describe('bulle d’explication (§ 11, P5.13 ; § 8, P6.36)', () => {
  it('prend le mot pour déclencheur, sans aucune icône', async () => {
    const mounted = await hint('vdot')

    expect(mounted.text()).toContain('Forme mesurée')
    expect(mounted.find('svg').exists()).toBe(false)
    expect(mounted.get('[role="button"]').classes()).toContain('explicable')
  })

  it('reste fermée tant que rien ne la vise', async () => {
    expect(bubbleOf((await hint('vdot')).get('[role="button"]'))).toBeNull()
  })

  it('s’ouvre au focus clavier et décrit le libellé', async () => {
    const mounted = await hint('vdot')
    await mounted.get('[role="button"]').trigger('focus')
    await nextTick()

    expect(bubbleOf(mounted.get('[role="button"]'))?.textContent).toContain(GLOSSARY.vdot.text)
  })

  it('se referme sur Échap', async () => {
    const mounted = await hint('rpe')
    await mounted.get('[role="button"]').trigger('focus')
    await nextTick()
    expect(bubbleOf(mounted.get('[role="button"]'))).not.toBeNull()

    await mounted.get('[role="button"]').trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(bubbleOf(mounted.get('[role="button"]'))).toBeNull()
  })

  it('sort de l’ordre de tabulation : cinquante-six arrêts n’ouvraient qu’une bulle', async () => {
    const trigger = (await hint('vdot')).get('[role="button"]')

    expect(trigger.attributes('tabindex')).toBe('-1')
    /** Une bulle ne se déplie pas : `aria-describedby` dit déjà ce qu'il faut. */
    expect(trigger.attributes('aria-expanded')).toBeUndefined()
  })
})

describe('densités de la bulle (§ 8, P6.36)', () => {
  const mount = (size?: 'sm' | 'md' | 'lg') =>
    mountSuspended(HoverBubble, {
      props: { label: 'Test', ...(size ? { size } : {}) },
      slots: { trigger: () => 'mot', default: () => 'contenu' },
    })

  /**
   * `useId` rend le même identifiant d'un montage à l'autre : une bulle laissée
   * en place serait retrouvée à la place de la nouvelle. On démonte après avoir lu.
   */
  const withBubble = async <T>(
    size: 'sm' | 'md' | 'lg' | undefined,
    read: (node: HTMLElement) => T,
  ) => {
    const mounted = await mount(size)
    await mounted.get('[role="button"]').trigger('focus')
    await nextTick()

    const id = mounted.get('[role="button"]').attributes('aria-describedby')!
    const value = read(document.getElementById(id)!)
    mounted.unmount()
    return value
  }

  const widthOf = (size?: 'sm' | 'md' | 'lg') => withBubble(size, (node) => node.style.maxWidth)

  it('borne sa largeur à sa densité, au lieu de la fixer', async () => {
    expect(await widthOf('sm')).toBe('190px')
    expect(await widthOf('md')).toBe('260px')
    expect(await widthOf('lg')).toBe('320px')
  })

  it('prend la densité du glossaire par défaut', async () => {
    expect(await widthOf()).toBe('260px')
  })

  it('porte une flèche, jamais collée au coin arrondi', async () => {
    const left = await withBubble('sm', (node) => {
      const arrow = node.querySelector('.bubble-arrow') as HTMLElement | null
      return arrow === null ? null : Number.parseFloat(arrow.style.left)
    })

    expect(left).not.toBeNull()
    expect(left!).toBeGreaterThanOrEqual(12)
  })
})
