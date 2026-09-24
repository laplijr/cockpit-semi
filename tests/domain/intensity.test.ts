import { describe, expect, it } from 'vitest'
import { TrainingZone } from '~~/server/domain/fitness/vdot'
import {
  INTENSITY_QUOTAS,
  sessionZoneSeconds,
  weeklyIntensity,
} from '~~/server/domain/load/intensity'
import { generatePlan } from '~~/server/domain/plan/generate'
import { PhaseType } from '~~/server/domain/plan/phases'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode } from '~~/server/domain/running/session-types'

/**
 * La répartition de l'intensité par semaine (P22), sur un vrai plan : elle
 * doit retrouver les quotas que le générateur s'impose.
 */
const VDOT = 34

const plan = generatePlan({
  today: '2026-11-02',
  constraints: { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] },
  races: [
    {
      id: 1,
      name: 'Semi de Paris',
      date: '2027-03-07',
      distanceM: 21097.5,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
    },
  ],
  baseWeeklyVolumeM: 25_000,
  peakWeeklyVolumeM: 45_000,
  vdot: VDOT,
})

type Week = (typeof plan.weeks)[number]

const sharesOf = (week: Week) =>
  weeklyIntensity(
    week.sessions.map((item) => ({
      prescription: item.prescription,
      vdot: VDOT,
      actualDurationS: null,
    })),
  )!

const codes = (week: Week) => week.sessions.map((item) => item.code)

describe('répartition de l’intensité', () => {
  it('tient une semaine type de développement sous les deux quotas', () => {
    const week = plan.weeks.find((item) => item.phaseType === PhaseType.Development && !item.light)!
    const shares = sharesOf(week)
    expect(shares[TrainingZone.Interval]).toBeLessThanOrEqual(
      INTENSITY_QUOTAS[TrainingZone.Interval],
    )
    expect(shares[TrainingZone.Threshold]).toBeLessThanOrEqual(
      INTENSITY_QUOTAS[TrainingZone.Threshold],
    )
    expect(Object.values(shares).reduce((total, value) => total + value, 0)).toBeCloseTo(1, 6)
  })

  it('approche les quotas sans les dépasser quand la semaine porte une VMA et un seuil', () => {
    const week = plan.weeks.find(
      (item) =>
        codes(item).includes(RunSessionCode.Vma) && codes(item).includes(RunSessionCode.Threshold),
    )!
    const shares = sharesOf(week)
    expect(shares[TrainingZone.Interval]).toBeLessThanOrEqual(
      INTENSITY_QUOTAS[TrainingZone.Interval],
    )
    expect(shares[TrainingZone.Threshold]).toBeLessThanOrEqual(
      INTENSITY_QUOTAS[TrainingZone.Threshold],
    )
    expect(shares[TrainingZone.Interval]).toBeGreaterThan(
      INTENSITY_QUOTAS[TrainingZone.Interval] / 2,
    )
    expect(shares[TrainingZone.Threshold]).toBeGreaterThan(
      INTENSITY_QUOTAS[TrainingZone.Threshold] / 2,
    )
  })

  it('compte la récupération des fractions en endurance', () => {
    const seconds = sessionZoneSeconds(
      {
        code: 'VMA',
        label: 'VMA',
        totalDistanceM: 2000,
        qualityDistanceM: 2000,
        expectedRpe: 8,
        steps: [
          { label: 'Fractions', repeats: 4, distanceM: 500, paceSecPerKm: 321, recoveryS: 150 },
        ],
      },
      VDOT,
    )
    expect(seconds[TrainingZone.Easy]).toBe(600)
    expect(seconds[TrainingZone.Interval]).toBeCloseTo(642, 0)
  })

  it('recale le prescrit sur la durée réelle sans changer la répartition d’une séance', () => {
    const week = plan.weeks.find((item) => item.phaseType === PhaseType.Development && !item.light)!
    const session = week.sessions.find((item) => item.key)!
    const planned = weeklyIntensity([
      { prescription: session.prescription, vdot: VDOT, actualDurationS: null },
    ])!
    const longer = weeklyIntensity([
      { prescription: session.prescription, vdot: VDOT, actualDurationS: 9000 },
    ])!
    expect(longer[TrainingZone.Interval]).toBeCloseTo(planned[TrainingZone.Interval], 6)
  })
})
