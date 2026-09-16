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
  it('marque la séance clé, comme la ligne du cockpit (§ 9, P5.12)', async () => {
    const cell = await mountSuspended(DayCell, {
      props: { label: 'mar', sessions: [session(true)] },
    })
    expect(cell.text()).toContain('clé')
  })

  it('réduit la pastille à sa lettre sur la page Semaine', async () => {
    const cell = await mountSuspended(DayCell, {
      props: { label: 'mar', sessions: [session(true)], compact: true },
    })
    expect(cell.text()).toContain('C')
    expect(cell.text()).not.toContain('clé')
  })

  it('ne marque rien quand la séance n’est pas clé', async () => {
    const cell = await mountSuspended(DayCell, {
      props: { label: 'mar', sessions: [session(false)] },
    })
    expect(cell.text()).not.toContain('clé')
  })
})
