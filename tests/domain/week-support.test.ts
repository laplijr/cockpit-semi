import { describe, expect, it } from 'vitest'
import { CycleSessionCode } from '~~/server/domain/cycling/session-types'
import { buildPhases } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import {
  CYCLING_MAX_LOAD_SHARE,
  STRENGTH_STOP_DAYS_BEFORE_RACE,
  buildWeekSupport,
} from '~~/server/domain/plan/week-support'
import { buildWeekTemplate } from '~~/server/domain/plan/week-template'
import { buildWeeks, type PlanWeek } from '~~/server/domain/plan/weeks'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { prescribedUnits } from '~~/server/domain/shared/prescription'
import { Sport } from '~~/server/domain/shared/sport'
import { StrengthSessionCode } from '~~/server/domain/strength/session-types'

const CONSTRAINTS = { availableDays: [1, 2, 3, 4, 5, 6, 7], longRunDay: 7, easyDays: [1] }
const VDOT = 33.15

const PARIS = {
  id: 1,
  name: 'Semi de Paris',
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.Time,
}

const phases = buildPhases('2026-10-05', [PARIS])
const weeks = buildWeeks({
  startDate: '2026-10-05',
  phases,
  baseWeeklyVolumeM: 20_000,
  peakWeeklyVolumeM: 45_000,
})

/** Calendrier plus long : la base y dure assez pour porter une semaine allégée. */
const longBase = buildWeeks({
  startDate: '2026-04-06',
  phases: buildPhases('2026-04-06', [PARIS]),
  baseWeeklyVolumeM: 20_000,
  peakWeeklyVolumeM: 45_000,
})

const weekIn = (phase: PhaseType, light = false) =>
  weeks.find((week) => week.phaseType === phase && week.light === light && !week.comebackRatio)!

function support(week: PlanWeek, overrides: Partial<Parameters<typeof buildWeekSupport>[0]> = {}) {
  const runs = buildWeekTemplate({ week, constraints: CONSTRAINTS, vdot: VDOT }).sessions
  return {
    runs,
    ...buildWeekSupport({ week, constraints: CONSTRAINTS, runs, weekInPhase: 2, ...overrides }),
  }
}

describe('placement du vélo (§ 5)', () => {
  it('ne pose jamais de vélo un jour de course à pied', () => {
    for (const week of weeks) {
      const { runs, sessions } = support(week)
      const runDays = new Set(runs.map((run) => run.weekday))
      const rides = sessions.filter((item) => item.sport === Sport.Cycling)
      expect(rides.every((ride) => !runDays.has(ride.weekday))).toBe(true)
    }
  })

  it('pose deux sorties en base et une seule en développement', () => {
    const base = support(weekIn(PhaseType.Base)).sessions.filter(
      (item) => item.sport === Sport.Cycling,
    )
    const development = support(weekIn(PhaseType.Development)).sessions.filter(
      (item) => item.sport === Sport.Cycling,
    )

    expect(base).toHaveLength(2)
    expect(development).toHaveLength(1)
  })

  it('privilégie le lendemain d’une séance clé', () => {
    const { runs, sessions } = support(weekIn(PhaseType.Development))
    const keyDays = new Set(runs.filter((run) => run.key).map((run) => run.weekday))
    const ride = sessions.find((item) => item.sport === Sport.Cycling)!

    expect(keyDays.has(ride.weekday - 1)).toBe(true)
  })

  it('passe une des deux sorties de base en sortie longue la semaine allégée', () => {
    const light = longBase.find(
      (week) => week.phaseType === PhaseType.Base && week.light && !week.comebackRatio,
    )!
    const codes = support(light)
      .sessions.filter((item) => item.sport === Sport.Cycling)
      .map((item) => item.code)

    expect(codes).toContain(CycleSessionCode.LongRide)
    expect(codes).toContain(CycleSessionCode.EnduranceZ2)
  })

  it('n’en pose aucune en affûtage', () => {
    const rides = support(weekIn(PhaseType.Taper)).sessions.filter(
      (item) => item.sport === Sport.Cycling,
    )
    expect(rides).toHaveLength(0)
  })

  it('garde le vélo sous 30 % de la charge en phase spécifique (§ 5)', () => {
    const { runs, sessions } = support(weekIn(PhaseType.Specific))
    const units = (list: { prescription: Parameters<typeof prescribedUnits>[0] }[]) =>
      list.reduce((total, item) => total + prescribedUnits(item.prescription), 0)

    const cycling = units(sessions.filter((item) => item.sport === Sport.Cycling))
    const total =
      cycling + units(sessions.filter((item) => item.sport !== Sport.Cycling)) + units(runs)

    expect(cycling / total).toBeLessThanOrEqual(CYCLING_MAX_LOAD_SHARE)
  })
})

describe('placement de la musculation (§ 5)', () => {
  it('pose le Legs sur un jour de séance clé, hors sortie longue', () => {
    const { runs, sessions } = support(weekIn(PhaseType.Development))
    const keyDays = new Set(
      runs
        .filter((run) => run.key && run.code !== RunSessionCode.LongRun)
        .map((run) => run.weekday),
    )
    const legs = sessions.find((item) => item.code === StrengthSessionCode.Legs)!

    expect(keyDays.has(legs.weekday)).toBe(true)
  })

  it('ne pose jamais de muscu la veille de la sortie longue', () => {
    for (const week of weeks) {
      const { runs, sessions } = support(week)
      const longRunDay = runs.find((run) => run.code === RunSessionCode.LongRun)?.weekday
      if (longRunDay === undefined) continue

      const legs = sessions.find((item) => item.code === StrengthSessionCode.Legs)
      expect(legs?.weekday).not.toBe(longRunDay - 1)
    }
  })

  it('coupe la muscu les sept jours avant une course A (§ 5)', () => {
    const raceWeek = weeks.find(
      (week) => week.startDate <= PARIS.date && PARIS.date <= week.endDate,
    )!
    const sessions = support(raceWeek, { nextRaceADate: PARIS.date }).sessions

    expect(sessions.filter((item) => item.sport === Sport.Strength)).toHaveLength(0)
    expect(
      support(raceWeek).sessions.filter((item) => item.sport === Sport.Strength).length,
    ).toBeGreaterThan(0)
  })

  it('retire le Legs quand une pause interdit la muscu jambes (§ 5)', () => {
    const allowances = {
      running: false,
      cycling: true,
      upperBodyStrength: true,
      legStrength: false,
    }
    const codes = support(weekIn(PhaseType.Development), { allowances }).sessions.map(
      (item) => item.code,
    )

    expect(codes).not.toContain(StrengthSessionCode.Legs)
    expect(codes).toContain(StrengthSessionCode.Push)
  })

  it('ne pose jamais deux séances de muscu le même jour', () => {
    for (const week of weeks) {
      const days = support(week)
        .sessions.filter((item) => item.sport === Sport.Strength)
        .map((item) => item.weekday)
      expect(new Set(days).size).toBe(days.length)
    }
  })
})

describe('bilan de la semaine', () => {
  it('compte les minutes de vélo et les séances de muscu', () => {
    const { targetCyclingMin, targetStrengthCount, sessions } = support(weekIn(PhaseType.Base))

    expect(targetStrengthCount).toBe(
      sessions.filter((item) => item.sport === Sport.Strength).length,
    )
    expect(targetCyclingMin).toBeGreaterThan(0)
  })

  it('l’arrêt muscu court bien sur sept jours', () => {
    expect(STRENGTH_STOP_DAYS_BEFORE_RACE).toBe(7)
  })
})
