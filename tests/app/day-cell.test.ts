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
    const mounted = await cell({ label: 'mar', sessions: [session(true)] })

    expect(mounted.find('.bg-accent').attributes('title')).toBe('Séance clé')
    expect(mounted.text()).not.toContain('clé')
  })

  it('garde le même point sur la page Semaine, où la place manque', async () => {
    const mounted = await cell({ label: 'mar', sessions: [session(true)], compact: true })

    expect(mounted.find('.bg-accent').exists()).toBe(true)
    expect(mounted.text()).not.toContain('C')
  })

  it('ne marque rien quand la séance n’est pas clé', async () => {
    expect(
      (await cell({ label: 'mar', sessions: [session(false)] })).find('.bg-accent').exists(),
    ).toBe(false)
  })

  it('remplace « · faite » par une coche', async () => {
    const done = { ...session(false), status: 'faite' }
    const mounted = await cell({ label: 'mar', sessions: [done] })

    expect(mounted.text()).not.toContain('faite')
    expect(mounted.find('svg.text-ok').attributes('title')).toBe('Faite')
  })
})
