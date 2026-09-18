import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PhaseRail from '~/components/ui/PhaseRail.vue'
import { PhaseType } from '~~/server/domain/plan/phases'

/**
 * La réglette remplace la liste de pastilles de phase (§ 8, P6.35) : sept
 * segments, les phases autorisées allumées, trois mots de légende.
 */
describe('réglette de phases', () => {
  const segments = async (allowed: string[]) => {
    const rail = await mountSuspended(PhaseRail, { props: { allowed } })
    return rail.findAll('span[title]').map((node) => node.classes().includes('bg-accent'))
  }

  it('compte sept segments et trois mots de légende', async () => {
    const rail = await mountSuspended(PhaseRail, { props: { allowed: [] } })

    expect(rail.findAll('span[title]')).toHaveLength(7)
    expect(rail.findAll('.mono span').map((node) => node.text())).toEqual([
      'base',
      'spécifique',
      'relance',
    ])
  })

  it('n’allume que les phases autorisées', async () => {
    expect(await segments([PhaseType.Specific, PhaseType.Taper])).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      false,
    ])
  })

  it('n’allume rien quand aucune phase n’est autorisée', async () => {
    expect(await segments([])).not.toContain(true)
  })

  it('range la base courte sur le segment de base, qui n’a pas le sien', async () => {
    expect(await segments([PhaseType.ShortBase])).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('ignore la transition, où aucune séance ne se pose', async () => {
    expect(await segments([PhaseType.Transition])).not.toContain(true)
  })
})
