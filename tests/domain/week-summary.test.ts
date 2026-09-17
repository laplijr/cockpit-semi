import { describe, expect, it } from 'vitest'
import {
  summariseWeek,
  type WeekLoadDay,
  type WeekSessionRecord,
} from '~~/server/domain/load/week-summary'
import { SessionStatus } from '~~/server/domain/plan/session'
import { Sport } from '~~/server/domain/shared/sport'

const week = { targetRunM: 40000, light: false, test: false, comebackRatio: null }

const day = (over: Partial<WeekLoadDay>): WeekLoadDay => ({
  runningUa: 0,
  cyclingUa: 0,
  strengthUa: 0,
  otherUa: 0,
  totalUa: 0,
  ...over,
})

const run = (over: Partial<WeekSessionRecord> = {}): WeekSessionRecord => ({
  sport: Sport.Running,
  status: SessionStatus.Done,
  actualDistanceM: 10000,
  ...over,
})

describe('résumé de semaine (§ 9, P5.14)', () => {
  it('répartit la charge par sport sans rien perdre du total', () => {
    const summary = summariseWeek(
      week,
      [
        day({ runningUa: 300, cyclingUa: 120, totalUa: 420 }),
        day({ strengthUa: 180, otherUa: 40, totalUa: 220 }),
      ],
      [run()],
    )!

    const parts = Object.values(summary.loadBySport).reduce((total, value) => total + value, 0)
    expect(summary.loadUa).toBe(640)
    expect(parts).toBe(summary.loadUa)
  })

  it('compare le réalisé au visé et compte les séances faites', () => {
    const summary = summariseWeek(
      week,
      [day({ runningUa: 500, totalUa: 500 })],
      [
        run({ actualDistanceM: 12000 }),
        run({ actualDistanceM: 21000 }),
        run({ status: SessionStatus.Skipped, actualDistanceM: null }),
        { sport: Sport.Strength, status: SessionStatus.Done, actualDistanceM: null },
      ],
    )!

    expect(summary.actualRunM).toBe(33000)
    expect(summary.runGapM).toBe(-7000)
    expect(summary.sessionsDone).toBe(3)
    expect(summary.sessionsPlanned).toBe(4)
  })

  it('ne compare rien tant qu’aucune course n’est enregistrée', () => {
    const summary = summariseWeek(week, [], [run({ status: SessionStatus.Planned })])!

    expect(summary.actualRunM).toBeNull()
    expect(summary.runGapM).toBeNull()
    expect(summary.loadUa).toBe(0)
  })

  it('rend un résumé vide, pas des zéros, pour une semaine sans rien', () => {
    expect(summariseWeek(week, [], [])).toBeUndefined()
  })

  it('porte les drapeaux allégée, test et reprise', () => {
    const summary = summariseWeek(
      { targetRunM: 20000, light: true, test: true, comebackRatio: 0.6 },
      [day({ totalUa: 100 })],
      [],
    )!

    expect(summary.light).toBe(true)
    expect(summary.test).toBe(true)
    expect(summary.comeback).toBe(true)
  })
})
