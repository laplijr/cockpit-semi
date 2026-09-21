import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import DayMealPlan from '~/components/nutrition/DayMealPlan.vue'
import RaceSearch from '~/components/races/RaceSearch.vue'
import TopBar from '~/components/shell/TopBar.vue'

registerEndpoint('/api/nutrition/meal-plan', () => ({ meals: null }))
registerEndpoint('/api/athlete', () => ({ firstName: 'Ronan', avatar: null }))

/** Ce que le plugin serveur pose à partir de `NUXT_ANTHROPIC_API_KEY`. */
function keyPresent(present: boolean) {
  useLlmAvailable().value = present
}

describe('fonctions du modèle sans clé (§ 6)', () => {
  beforeEach(() => {
    keyPresent(true)
    useUiStore().closePanel()
  })

  it('propose la recherche de course quand la clé est là', async () => {
    const mounted = await mountSuspended(RaceSearch)

    expect(mounted.find('input[type="text"]').exists()).toBe(true)
    expect(mounted.text()).toContain('Chercher')
  })

  it('remplace la recherche de course par le renvoi au formulaire manuel', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(RaceSearch)

    expect(mounted.find('input[type="text"]').exists()).toBe(false)
    expect(mounted.find('button').exists()).toBe(false)
    expect(mounted.text()).toContain('la clé du modèle est absente')
  })

  it('propose le plan de nutrition quand la clé est là', async () => {
    const mounted = await mountSuspended(DayMealPlan, { props: { date: '2026-09-21' } })

    expect(mounted.text()).toContain('Demander le plan de nutrition')
  })

  it('ne propose aucun plan de nutrition sans clé', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(DayMealPlan, { props: { date: '2026-09-21' } })

    expect(mounted.text()).not.toContain('Demander le plan de nutrition')
    expect(mounted.text()).toContain('Plan de nutrition indisponible')
  })

  it('ouvre l’Imprévu depuis la barre haute quand la clé est là', async () => {
    const mounted = await mountSuspended(TopBar)
    const trigger = mounted.get('button')

    expect(trigger.attributes('disabled')).toBeUndefined()
    await trigger.trigger('click')

    expect(useUiStore().panel).toBe('imprevu')
  })

  it('désactive l’Imprévu sans clé, et le dit à la place du raccourci', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(TopBar)
    const trigger = mounted.get('button')

    expect(trigger.attributes('disabled')).toBeDefined()
    expect(trigger.text()).toContain('Imprévu indisponible')
    expect(trigger.text()).not.toContain('⌘K')

    await trigger.trigger('click')
    expect(useUiStore().panel).toBeNull()
  })
})
