import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import RouteWindow from '~/components/races/RouteWindow.vue'

const POINTS = [
  { lat: 40.4155, lon: -3.7074 },
  { lat: 40.4245, lon: -3.7074 },
  { lat: 40.4245, lon: -3.6956 },
  { lat: 40.4155, lon: -3.7074 },
]

const variant = (id: number, rank: number, elevationGainM: number) => ({
  id,
  raceId: 9,
  address: '12 calle Mayor, Madrid',
  lat: 40.4155,
  lon: -3.7074,
  sessionId: 2,
  date: '2027-04-03',
  code: 'EF',
  kind: 'boucle',
  targetDistanceM: 5000,
  seed: rank + 1,
  distanceM: 5020,
  elevationGainM,
  turns: 6,
  rank,
  points: POINTS,
})

registerEndpoint('/api/races', () => [
  { id: 9, name: 'Semi de Madrid', date: '2027-04-04', distanceM: 21097.5 },
])

registerEndpoint('/api/races/9/routes', () => [variant(31, 0, 12), variant(32, 1, 30)])

describe('fenêtre Itinéraires (§ 8, P5.5)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('dessine la trace en SVG, sans fond de carte', async () => {
    const window = await mountSuspended(RouteWindow, { props: { raceId: 9 } })
    expect(window.get('svg path').attributes('d')).toMatch(/^M[\d.]+ [\d.]+ L/)
  })

  it('montre la variante la mieux classée et nomme sa sortie', async () => {
    const window = await mountSuspended(RouteWindow, { props: { raceId: 9 } })

    expect(window.text()).toContain('Endurance')
    expect(window.text()).toContain('D+ 12 m')
  })

  it('offre le GPX en téléchargement et l’autre variante en lien', async () => {
    const window = await mountSuspended(RouteWindow, { props: { raceId: 9 } })

    expect(window.get('a[download]').attributes('href')).toBe('/api/routes/31')
    expect(window.text()).toContain('Autre variante')
  })

  it('passe à la variante suivante sans quitter la fenêtre', async () => {
    const window = await mountSuspended(RouteWindow, { props: { raceId: 9 } })
    await window.get('button.mono').trigger('click')

    expect(window.get('a[download]').attributes('href')).toBe('/api/routes/32')
    expect(window.text()).toContain('D+ 30 m')
  })

  it('propose la veille de la course comme arrivée sur place', async () => {
    const window = await mountSuspended(RouteWindow, { props: { raceId: 9 } })
    const field = window.get('input[type="date"]').element as HTMLInputElement
    expect(field.value).toBe('2027-04-03')
  })
})
