import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DayCell from '~/components/cockpit/DayCell.vue'
import type { PlanSession } from '~/stores/plan'

const session = (key: boolean): PlanSession => ({
  id: 1,
  weekId: 1,
  date: '2026-11-24',
  sport: 'course',
  code: 'VMA',
  key,
  status: 'prevue',
  actualDurationMin: null,
  actualDistanceM: null,
  feedbackRpe: null,
  prescription: { label: 'VMA', totalDistanceM: 5000, expectedRpe: 8, steps: [] },
})

describe('cellule de jour', () => {
  const cell = (props: Record<string, unknown>) => mountSuspended(DayCell, { props })

  it('marque la séance clé d’un point accent (§ 8, P6.35)', async () => {
    const mounted = await cell({ label: 'mar', date: '2026-11-24', sessions: [session(true)] })

    /** Le point se nomme par sa bulle, plus par un `title` natif (§ 8, P6.36). */
    expect(mounted.find('[aria-label="Séance clé"]').exists()).toBe(true)
    expect(mounted.find('.bg-accent').exists()).toBe(true)
    expect(mounted.text()).not.toContain('clé')
  })

  it('garde le même point sur la page Semaine, où la place manque', async () => {
    const mounted = await cell({
      label: 'mar',
      date: '2026-11-24',
      sessions: [session(true)],
      compact: true,
    })

    expect(mounted.find('.bg-accent').exists()).toBe(true)
    expect(mounted.find('.pill').exists()).toBe(false)
  })

  it('ne marque rien quand la séance n’est pas clé', async () => {
    expect(
      (await cell({ label: 'mar', date: '2026-11-24', sessions: [session(false)] }))
        .find('.bg-accent')
        .exists(),
    ).toBe(false)
  })

  it('montre le réalisé dès que la séance est faite et mesurée (§ 8, P7.4)', async () => {
    const done = { ...session(false), status: 'faite', actualDistanceM: 4200 }
    const mounted = await cell({ label: 'mar', date: '2026-11-24', sessions: [done] })

    expect(mounted.text()).toContain('4,2 km')
    expect(mounted.text()).not.toContain('5,0 km')
  })

  it('garde le prescrit quand la séance faite n’a pas de mesure', async () => {
    const done = { ...session(false), status: 'faite' }

    expect((await cell({ label: 'mar', date: '2026-11-24', sessions: [done] })).text()).toContain(
      '5,0 km',
    )
  })

  it('remplace « · faite » par une coche, qui porte enfin son nom', async () => {
    const done = { ...session(false), status: 'faite' }
    const mounted = await cell({ label: 'mar', date: '2026-11-24', sessions: [done] })

    expect(mounted.text()).not.toContain('faite')
    /** Le `title` posé sur un `<svg aria-hidden>` ne disait rien : c'est un vrai nom (§ 8, P6.36). */
    const check = mounted.find('svg.text-ok')
    expect(check.attributes('aria-hidden')).toBeUndefined()
    expect(check.find('title').text()).toBe('Faite')
  })
})
