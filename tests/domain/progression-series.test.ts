import { describe, expect, it } from 'vitest'
import {
  coveredByPause,
  sessionDays,
  strengthSeries,
} from '~~/server/domain/load/progression-series'
import { SessionStatus } from '~~/server/domain/plan/session'

describe('séries de Progression (§ 9, P6)', () => {
  it('rend une ligne par jour, jours vides compris, et ne compte que le fait', () => {
    const days = sessionDays(
      [
        { date: '2026-11-20', status: SessionStatus.Done },
        { date: '2026-11-20', status: SessionStatus.Modified },
        { date: '2026-11-22', status: SessionStatus.Done },
      ],
      '2026-11-23',
    )

    expect(days).toEqual([
      { date: '2026-11-20', sessions: 1 },
      { date: '2026-11-21', sessions: 0 },
      { date: '2026-11-22', sessions: 1 },
      { date: '2026-11-23', sessions: 0 },
    ])
  })

  it('garde un point par séance, le plus lourd, et écarte ce qui ne se charge pas', () => {
    const series = strengthSeries([
      { date: '2026-11-02', exerciseId: 'squat', loadKg: 60 },
      { date: '2026-11-02', exerciseId: 'squat', loadKg: 65 },
      { date: '2026-11-09', exerciseId: 'squat', loadKg: 67 },
      { date: '2026-11-02', exerciseId: 'nordic', loadKg: 0 },
      { date: '2026-11-09', exerciseId: 'nordic', loadKg: 0 },
    ])

    expect(series).toHaveLength(1)
    expect(series[0]!.points).toEqual([
      { date: '2026-11-02', loadKg: 65 },
      { date: '2026-11-09', loadKg: 67 },
    ])
  })

  it('excuse une semaine qu’une pause recouvre, même en partie', () => {
    const pauses = [{ startDate: '2026-11-19', endDate: null }]
    expect(coveredByPause('2026-11-16', '2026-11-22', pauses)).toBe(true)
    expect(coveredByPause('2026-11-09', '2026-11-15', pauses)).toBe(false)
  })
})
