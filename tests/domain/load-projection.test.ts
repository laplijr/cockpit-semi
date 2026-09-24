import { describe, expect, it } from 'vitest'
import { dailyLoads } from '~~/server/domain/load/load'
import { firstExitFromBand, projectLoads, ratioSeries } from '~~/server/domain/load/projection'
import { addDays } from '~~/server/domain/plan/calendar'
import { generatePlan } from '~~/server/domain/plan/generate'
import { PhaseType } from '~~/server/domain/plan/phases'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { prescribedUnits } from '~~/server/domain/shared/prescription'
import { Sport } from '~~/server/domain/shared/sport'

/**
 * La charge prolongée jusqu'au jour J (P22) : les séances prévues, converties
 * par `prescribedUnits`, prolongent le réalisé. Le plan est un vrai plan du
 * générateur, pas une frise écrite à la main.
 */
const TODAY = '2026-11-02'
const PARIS = '2027-03-07'

const plan = generatePlan({
  today: TODAY,
  constraints: { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] },
  races: [
    {
      id: 1,
      name: 'Semi de Paris',
      date: PARIS,
      distanceM: 21097.5,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
    },
  ],
  baseWeeklyVolumeM: 25_000,
  peakWeeklyVolumeM: 45_000,
  vdot: 34,
})

const planned = plan.weeks.flatMap((week) => [
  ...week.sessions.map((item) => ({
    date: item.date,
    sport: Sport.Running,
    units: prescribedUnits(item.prescription),
  })),
  ...week.support.map((item) => ({
    date: item.date,
    sport: item.sport,
    units: prescribedUnits(item.prescription),
  })),
])

/** Quatre semaines de réalisé à la charge de la première semaine du plan. */
const firstWeekUnits = planned
  .filter((item) => item.date < addDays(TODAY, 7))
  .reduce((total, item) => total + item.units, 0)
const history = dailyLoads(
  Array.from({ length: 28 }, (_, index) => ({
    date: addDays(TODAY, -28 + index),
    sport: Sport.Running,
    rpe: 1,
    durationMin: firstWeekUnits / 7,
  })),
)

const loads = projectLoads(history, planned, TODAY)
const series = ratioSeries(loads, TODAY, PARIS, TODAY)
const ratioOn = (date: string) => series.find((point) => point.date === date)?.ratio ?? null

const weeksOf = (type: PhaseType) => plan.weeks.filter((week) => week.phaseType === type)

describe('charge prolongée jusqu’au jour J', () => {
  it('reste dans la bande quand le plan est tenu en développement', () => {
    const fullWeeks = weeksOf(PhaseType.Development).filter((week) => !week.light)
    expect(fullWeeks.length).toBeGreaterThan(0)
    for (const week of fullWeeks) {
      const ratio = ratioOn(week.endDate)!
      expect(ratio).toBeGreaterThanOrEqual(0.8)
      expect(ratio).toBeLessThanOrEqual(1.3)
    }
  })

  it('descend sous 0,8 dans les dix jours qui précèdent la course A', () => {
    const lastTen = series.filter((point) => point.date >= addDays(PARIS, -10))
    expect(lastTen.some((point) => point.ratio !== null && point.ratio < 0.8)).toBe(true)
  })

  /**
   * En développement. La semaine allégée de base, elle, porte la sortie longue
   * vélo de 150′ (P4) : sa charge combinée dépasse celle de la semaine pleine
   * d'avant, et la projection le montre — consigné sous la case de P22.
   */
  it('se creuse à la place d’une semaine allégée', () => {
    const light = weeksOf(PhaseType.Development).find((week) => week.light)!
    const before = plan.weeks.find((week) => week.endDate === addDays(light.startDate, -1))!
    expect(ratioOn(light.endDate)!).toBeLessThan(ratioOn(before.endDate)!)
  })

  it('ne compte que le réalisé avant aujourd’hui : une séance passée sans nouvelles vaut zéro', () => {
    const projected = projectLoads(
      [],
      [{ date: addDays(TODAY, -1), sport: Sport.Running, units: 400 }],
      TODAY,
    )
    expect(projected).toEqual([])
  })

  it('ne compte pas comme une sortie une courbe déjà hors de la bande', () => {
    const points = [
      { date: '2026-11-24', ratio: 0.55, projected: false },
      { date: '2026-11-25', ratio: 0.6, projected: true },
      { date: '2026-11-26', ratio: 0.9, projected: true },
      { date: '2026-11-27', ratio: 1.4, projected: true },
    ]
    expect(firstExitFromBand(points)?.date).toBe('2026-11-27')
  })

  it('nomme le premier jour projeté hors de la bande', () => {
    const exit = firstExitFromBand(series)
    expect(exit?.projected).toBe(true)
    expect(exit!.ratio! < 0.8 || exit!.ratio! > 1.3).toBe(true)
  })
})
