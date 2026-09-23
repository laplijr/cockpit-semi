import { mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import WeekBars, { type WeekBar } from '~/components/ui/WeekBars.vue'
import { Sport } from '~~/server/domain/shared/sport'

const week = (over: Partial<WeekBar> & { index: number }): WeekBar => ({
  startDate: '2026-11-16',
  endDate: '2026-11-22',
  phaseType: 'developpement',
  targetRunM: 32000,
  light: false,
  test: false,
  comebackRatio: null,
  loadUa: 0,
  ...over,
})

const summary = (actualRunM: number, loadUa: number) => ({
  targetRunM: 32000,
  actualRunM,
  runGapM: actualRunM - 32000,
  loadUa,
  loadBySport: {
    [Sport.Running]: loadUa,
    [Sport.Cycling]: 0,
    [Sport.Strength]: 0,
    [Sport.Other]: 0,
  },
  sessionsPlanned: 4,
  sessionsDone: 4,
  longRun: { planned: 1, done: 1 },
  quality: { planned: 1, done: 1 },
  light: false,
  test: false,
  comeback: false,
})

/** Hauteurs des trois barres d'une semaine, dans l'ordre : visé, couru, charge. */
function heightsOf(node: { attributes: (name: string) => string | undefined }) {
  return Number.parseFloat(node.attributes('style')?.match(/height: ([\d.]+)px/)?.[1] ?? '0')
}

const mount = (weeks: WeekBar[]) => mountSuspended(WeekBars, { props: { weeks, height: 100 } })

/** Les barres seules : le conteneur porte lui aussi une hauteur en ligne. */
const barsOf = async (weeks: WeekBar[]) => {
  const mounted = await mount(weeks)
  return mounted.findAll('.rounded-t-\\[2px\\]').map(heightsOf)
}

/**
 * Trois barres par semaine et rien autour (§ 9, P6.39) : la légende, la
 * gouttière et le gris ont disparu, la bulle de survol porte la lecture.
 */
describe('barres de semaine', () => {
  it('dessine trois barres pour une semaine enregistrée', async () => {
    const [target, actual, load] = await barsOf([
      week({ index: 1, loadUa: 400, summary: summary(30_000, 400) }),
    ])

    expect(target).toBe(100)
    expect(actual).toBeGreaterThan(0)
    expect(actual).toBeLessThan(target!)
    expect(load).toBe(100)
  })

  it('tient les deux places du réalisé sur une semaine à venir', async () => {
    const heights = await barsOf([week({ index: 1 })])

    /** Trois barres dessinées, dont deux à zéro : l'abscisse ne se déforme pas. */
    expect(heights).toHaveLength(3)
    expect(heights[1]).toBe(0)
    expect(heights[2]).toBe(0)
  })

  it('ne met aucun gris sur une semaine allégée : son visé est déjà plus bas', async () => {
    const mounted = await mount([week({ index: 1, targetRunM: 20_000, light: true })])

    expect(mounted.html()).not.toContain('bg-line-strong')
    /** Le sommet garde un liseré pointillé — même chose, en moins. */
    expect(mounted.find('.border-dashed').exists()).toBe(true)
  })

  it('garde deux échelles indépendantes : doubler la charge ne bouge pas les kilomètres', async () => {
    const light = await barsOf([
      week({ index: 1, loadUa: 200, summary: summary(30_000, 200) }),
      week({ index: 2, loadUa: 400, summary: summary(28_000, 400) }),
    ])
    const heavy = await barsOf([
      week({ index: 1, loadUa: 400, summary: summary(30_000, 400) }),
      week({ index: 2, loadUa: 800, summary: summary(28_000, 800) }),
    ])

    expect(heavy.filter((unused, index) => index % 3 !== 2)).toEqual(
      light.filter((unused, index) => index % 3 !== 2),
    )
  })

  it('rapporte les kilomètres au plus haut des visés et des courus', async () => {
    const [target, actual] = await barsOf([
      week({ index: 1, targetRunM: 20_000, summary: summary(40_000, 0) }),
    ])

    expect(actual).toBe(100)
    expect(target).toBe(50)
  })

  it('n’a plus ni légende ni gris dans son code', () => {
    const source = readFileSync('app/components/ui/WeekBars.vue', 'utf8')

    expect(source).not.toContain('bg-line-strong')
    expect(source).not.toContain('legend')
  })
})
