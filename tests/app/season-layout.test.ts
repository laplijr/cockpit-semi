import { describe, expect, it } from 'vitest'
import {
  RACE_COLLISION_PCT,
  seasonLayout,
  type SeasonPhase,
  type SeasonWeek,
} from '~/utils/season-layout'

const MONDAY = Date.UTC(2026, 9, 19, 12)
const WEEK_MS = 7 * 86_400_000

const iso = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10)

function weeksOf(count: number): SeasonWeek[] {
  return Array.from({ length: count }, (unused, index) => ({
    index: index + 1,
    startDate: iso(MONDAY + index * WEEK_MS),
    endDate: iso(MONDAY + index * WEEK_MS + 6 * 86_400_000),
    phaseType: 'base',
    targetRunM: 40000,
    light: false,
    test: false,
  }))
}

/** Date du premier jour de la semaine `index`, comptée à partir de 1. */
const weekStart = (index: number) => iso(MONDAY + (index - 1) * WEEK_MS)

const phases: SeasonPhase[] = [
  { id: 1, type: 'base', startWeek: 1, endWeek: 20, raceId: null },
  { id: 2, type: 'developpement', startWeek: 21, endWeek: 35, raceId: null },
  { id: 3, type: 'specifique', startWeek: 36, endWeek: 50, raceId: 1 },
]

const weeks = weeksOf(50)

describe('géométrie de la frise de saison (§ 9, P5.16)', () => {
  it('des phases contiguës somment à 100 %', () => {
    const layout = seasonLayout({ phases, weeks, races: [], today: weekStart(3), dated: true })
    const total = layout.segments.reduce((sum, segment) => sum + segment.sharePct, 0)

    expect(total).toBeCloseTo(100, 6)
    expect(layout.segments.map((segment) => segment.weeks)).toEqual([20, 15, 15])
  })

  it('marque la phase qui porte aujourd’hui, et elle seule', () => {
    const layout = seasonLayout({ phases, weeks, races: [], today: weekStart(25), dated: true })

    expect(layout.segments.filter((segment) => segment.current).map((s) => s.type)).toEqual([
      'developpement',
    ])
    expect(layout.currentWeekIndex).toBe(25)
  })

  it('empile sur deux niveaux deux courses à cinq semaines sur une saison de cinquante', () => {
    const races = [
      { id: 1, name: 'Paris', date: weekStart(40), priority: 'A' },
      { id: 2, name: 'Madrid', date: weekStart(45), priority: 'B' },
    ]
    const layout = seasonLayout({ phases, weeks, races, today: weekStart(3), dated: true })

    expect(layout.races.map((mark) => mark.level)).toEqual([0, 1])
    expect(layout.races[1]!.positionPct - layout.races[0]!.positionPct).toBeLessThan(
      RACE_COLLISION_PCT,
    )
  })

  it('laisse au ras de la barre deux courses assez espacées', () => {
    const races = [
      { id: 1, name: 'Paris', date: weekStart(30), priority: 'A' },
      { id: 2, name: 'Madrid', date: weekStart(45), priority: 'B' },
    ]
    const layout = seasonLayout({ phases, weeks, races, today: weekStart(3), dated: true })

    expect(layout.races.map((mark) => mark.level)).toEqual([0, 0])
  })

  it('date l’axe et place aujourd’hui et les courses en proportion', () => {
    const races = [{ id: 1, name: 'Paris', date: weekStart(26), priority: 'A' }]
    const layout = seasonLayout({ phases, weeks, races, today: weekStart(26), dated: true })

    expect(layout.todayPct).toBeCloseTo(layout.races[0]!.positionPct, 6)
    expect(layout.todayPct).toBeGreaterThan(49)
    expect(layout.todayPct).toBeLessThan(52)
    expect(layout.ticks.length).toBeGreaterThan(10)
    expect(layout.ticks.every((tick) => tick.positionPct >= 0 && tick.positionPct <= 100)).toBe(
      true,
    )
  })

  it('écarte une course hors saison plutôt que de la coller au bord', () => {
    const races = [{ id: 9, name: 'Trop tard', date: iso(MONDAY + 60 * WEEK_MS), priority: 'C' }]
    const layout = seasonLayout({ phases, weeks, races, today: weekStart(3), dated: true })

    expect(layout.races).toEqual([])
  })

  it('un plan non daté rend ses segments, ni axe ni repères', () => {
    const races = [{ id: 1, name: 'Paris', date: weekStart(40), priority: 'A' }]
    const layout = seasonLayout({ phases, weeks, races, today: weekStart(3), dated: false })

    expect(layout.segments).toHaveLength(3)
    expect(layout.segments.every((segment) => segment.startDate === null)).toBe(true)
    expect(layout.dated).toBe(false)
    expect(layout.todayPct).toBeNull()
    expect(layout.races).toEqual([])
    expect(layout.ticks).toEqual([])
  })
})
