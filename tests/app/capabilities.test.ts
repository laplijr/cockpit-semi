import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import DayMealPlan from '~/components/nutrition/DayMealPlan.vue'
import NewRaceWindow from '~/components/races/NewRaceWindow.vue'
import RouteSuggestion from '~/components/sessions/RouteSuggestion.vue'
import TopBar from '~/components/shell/TopBar.vue'

registerEndpoint('/api/nutrition/meal-plan', () => ({ meals: null }))
registerEndpoint('/api/athlete', () => ({ firstName: 'Ronan', avatar: null }))
registerEndpoint('/api/sessions/7/routes', () => ({ routes: [], homeAddress: null }))

/** Ce que le plugin serveur pose à partir de `NUXT_ANTHROPIC_API_KEY`. */
function keyPresent(present: boolean) {
  useLlmAvailable().value = present
}

/** Et à partir de `NUXT_ORS_API_KEY`, pour les itinéraires. */
function routingKeyPresent(present: boolean) {
  useRoutingAvailable().value = present
}

/**
 * Sans clé, les fonctions du modèle ne se désactivent pas : elles n'existent
 * pas. L'écran n'a pas à expliquer une configuration à qui n'y peut rien (§ 6).
 */
describe('fonctions du modèle sans clé (§ 6)', () => {
  beforeEach(() => {
    keyPresent(true)
    routingKeyPresent(true)
    useUiStore().closePanel()
  })

  it('ouvre l’Imprévu depuis la barre haute quand la clé est là', async () => {
    const mounted = await mountSuspended(TopBar)
    const trigger = mounted.get('button')

    expect(trigger.text()).toContain('Signaler un imprévu')
    await trigger.trigger('click')

    expect(useUiStore().panel).toBe('imprevu')
  })

  it('retire les deux déclencheurs de l’Imprévu sans clé', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(TopBar)

    expect(mounted.text()).not.toContain('imprévu')
    expect(mounted.find('[aria-label*="imprévu"]').exists()).toBe(false)
    expect(mounted.text()).not.toContain('⌘K')
  })

  it('propose la recherche de course quand la clé est là', async () => {
    const mounted = await mountSuspended(NewRaceWindow)

    expect(mounted.text()).toContain('Rechercher la course')
  })

  it('rend la fenêtre d’une course à son seul formulaire sans clé', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(NewRaceWindow)

    expect(mounted.text()).not.toContain('Rechercher la course')
    expect(mounted.text()).not.toContain('clé')
    /** La colonne de 320 px et son filet partent avec la recherche. */
    expect(mounted.get('div').classes()).not.toContain('lean:grid-cols-[320px_1fr]')
    expect(mounted.text()).toContain('Ajouter et régénérer le plan')
  })

  it('propose le plan de nutrition quand la clé est là', async () => {
    const mounted = await mountSuspended(DayMealPlan, { props: { date: '2026-09-21' } })

    expect(mounted.text()).toContain('Demander le plan de nutrition')
  })

  it('efface la tuile des repas sans clé, plutôt que de la vider', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(DayMealPlan, { props: { date: '2026-09-21' } })

    expect(mounted.find('.tile').exists()).toBe(false)
    expect(mounted.text()).toBe('')
  })

  it('propose une boucle quand la clé des itinéraires est là', async () => {
    const mounted = await mountSuspended(RouteSuggestion, {
      props: { sessionId: 7, distanceM: 10_000 },
    })

    expect(mounted.text()).toContain('Itinéraire')
    expect(mounted.find('[aria-label="Adresse de départ"]').exists()).toBe(true)
  })

  it('efface la tuile d’itinéraire sans la clé des itinéraires', async () => {
    routingKeyPresent(false)
    const mounted = await mountSuspended(RouteSuggestion, {
      props: { sessionId: 7, distanceM: 10_000 },
    })

    expect(mounted.find('.tile').exists()).toBe(false)
    expect(mounted.text()).toBe('')
  })

  /** Les deux clés sont indépendantes : l'une absente n'emporte pas l'autre. */
  it('garde les itinéraires quand seule la clé du modèle manque', async () => {
    keyPresent(false)
    const mounted = await mountSuspended(RouteSuggestion, {
      props: { sessionId: 7, distanceM: 10_000 },
    })

    expect(mounted.find('[aria-label="Adresse de départ"]').exists()).toBe(true)
  })
})
