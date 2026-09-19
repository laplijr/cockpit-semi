import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import FuelIntakes from '~/components/races/FuelIntakes.vue'
import { FuelProduct, type FuelIntake } from '~~/server/domain/nutrition/fuel-plan'

/**
 * Le ravito se lit sur une frise horaire tant qu'il tient en six prises ; au-delà
 * les étiquettes se chevauchent et la table reprend la main (§ 8, P6.35).
 */
function intakes(count: number): FuelIntake[] {
  return Array.from({ length: count }, (_, index) => ({
    minute: 20 * (index + 1),
    km: 3 * (index + 1),
    product: FuelProduct.Water,
    quantity: '150 à 250 ml',
    optional: false,
  }))
}

describe('ravito en course (§ 8, P6.35)', () => {
  const mount = (taken: FuelIntake[]) => mountSuspended(FuelIntakes, { props: { intakes: taken } })

  it('dessine une frise tant que six prises suffisent', async () => {
    const mounted = await mount(intakes(6))

    expect(mounted.find('table').exists()).toBe(false)
    expect(mounted.findAll('.rounded-full')).toHaveLength(6)
    expect(mounted.text()).toContain('20′ · km 3')
  })

  it('repasse à la table dès la septième prise', async () => {
    const mounted = await mount(intakes(7))

    expect(mounted.find('table').exists()).toBe(true)
    expect(mounted.findAll('tbody tr')).toHaveLength(7)
  })

  it('tient l’eau et le gel pris ensemble sur un seul repère', async () => {
    const together = [
      ...intakes(2),
      { minute: 20, km: 3, product: FuelProduct.Gel, quantity: '1 gel', optional: false },
    ]
    const mounted = await mount(together)

    expect(mounted.findAll('.rounded-full')).toHaveLength(2)
    expect(mounted.text()).toContain('1 gel')
  })

  it('range les repères dans l’ordre de la course', async () => {
    const mounted = await mount([...intakes(3)].reverse())
    const minutes = mounted
      .findAll('.mono')
      .map((node) => node.text())
      .filter((text) => text.includes('′'))

    expect(minutes).toEqual(['20′ · km 3', '40′ · km 6', '60′ · km 9'])
  })

  it('ne dessine rien quand la course ne se ravitaille pas', async () => {
    const mounted = await mount([])

    expect(mounted.find('table').exists()).toBe(false)
    expect(mounted.findAll('.rounded-full')).toHaveLength(0)
  })
})
