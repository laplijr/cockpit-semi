import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Pager from '~/components/ui/Pager.vue'

/**
 * Le pied de pagination : une tuile trop longue n'en montre plus qu'une page
 * (§ 8). Sous deux pages il ne s'affiche pas — une liste courte n'a rien à
 * paginer.
 */
describe('pied de pagination', () => {
  const mount = (total: number, page = 1, perPage = 10) =>
    mountSuspended(Pager, { props: { total, perPage, modelValue: page } })

  it('ne s’affiche pas quand tout tient sur une page', async () => {
    expect((await mount(10)).find('button').exists()).toBe(false)
  })

  it('dit ce qu’on lit et sur combien', async () => {
    const pager = await mount(99, 2)

    expect(pager.find('.mono').text()).toBe('11–20 sur 99')
    expect(pager.findAll('.mono')[1]!.text()).toBe('2 / 10')
  })

  it('borne la dernière page au reste de la liste', async () => {
    expect((await mount(99, 10)).find('.mono').text()).toBe('91–99 sur 99')
  })

  it('éteint « précédent » sur la première page et « suivant » sur la dernière', async () => {
    const first = await mount(30, 1)
    expect(
      first.findAll('button').map((node) => node.attributes('disabled') !== undefined),
    ).toEqual([true, false])

    const last = await mount(30, 3)
    expect(last.findAll('button').map((node) => node.attributes('disabled') !== undefined)).toEqual(
      [false, true],
    )
  })

  it('demande la page suivante sans la décider lui-même', async () => {
    const pager = await mount(30, 2)
    await pager.findAll('button')[1]!.trigger('click')

    expect(pager.emitted('update:modelValue')).toEqual([[3]])
  })
})

/** Le découpage lui-même : il suit la liste, y compris quand elle raccourcit. */
describe('liste paginée', () => {
  it('ne montre que la page demandée', () => {
    const rows = Array.from({ length: 22 }, (_, index) => index)
    const paged = usePagedList(() => rows, 10)

    expect(paged.items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

    paged.page = 3
    expect(paged.items).toEqual([20, 21])
    expect(paged.total).toBe(22)
  })

  it('ramène la page dans la liste quand celle-ci raccourcit', async () => {
    const rows = ref(Array.from({ length: 22 }, (_, index) => index))
    const paged = usePagedList(() => rows.value, 10)

    paged.page = 3
    rows.value = rows.value.slice(0, 5)
    await nextTick()

    expect(paged.page).toBe(1)
    expect(paged.items).toEqual([0, 1, 2, 3, 4])
  })
})
