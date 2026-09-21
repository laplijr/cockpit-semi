import { describe, expect, it } from 'vitest'
import { CycleSessionCode } from '~~/server/domain/cycling/session-types'
import { buildPhases } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import {
  CYCLING_MAX_LOAD_SHARE,
  STRENGTH_STOP_DAYS_BEFORE_RACE,
  buildWeekSupport,
} from '~~/server/domain/plan/week-support'
import { buildWeekTemplate, dayBefore, dayGap } from '~~/server/domain/plan/week-template'
import { buildWeeks, type PlanWeek } from '~~/server/domain/plan/weeks'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { prescribedUnits } from '~~/server/domain/shared/prescription'
import { Sport } from '~~/server/domain/shared/sport'
import { strengthExercise } from '~~/server/domain/strength/exercises'
import { StrengthSessionCode, strengthSessionType } from '~~/server/domain/strength/session-types'

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

  it('privilégie le lendemain d’une séance clé, dimanche compris', () => {
    const { runs, sessions } = support(weekIn(PhaseType.Development))
    const keyDays = new Set(runs.filter((run) => run.key).map((run) => run.weekday))
    const ride = sessions.find((item) => item.sport === Sport.Cycling)!

    expect(keyDays.has(dayBefore(ride.weekday))).toBe(true)
  })

  it('prend le lundi qui suit la sortie longue du dimanche', () => {
    const { runs, sessions } = support(weekIn(PhaseType.Specific))
    const longRun = runs.find((run) => run.code === RunSessionCode.LongRun)!
    expect(longRun.weekday).toBe(7)

    const rides = sessions.filter((item) => item.sport === Sport.Cycling)
    expect(rides.map((item) => item.weekday)).toContain(1)
  })

  it('n’ajoute pas d’intensité vélo dans une semaine allégée', () => {
    const light = longBase.find(
      (week) => week.phaseType === PhaseType.Base && week.light && !week.comebackRatio,
    )!
    const codes = support(light).sessions.map((item) => item.code)
    expect(codes).not.toContain(CycleSessionCode.LowCadenceForce)
  })

  it('pose une force basse cadence en base, à 48 h au moins du Legs (§ 5)', () => {
    const forces = []
    for (const week of weeks.filter((item) => item.phaseType === PhaseType.Base)) {
      const { sessions } = support(week)
      const legs = sessions.find((item) => item.code === StrengthSessionCode.Legs)
      for (const ride of sessions.filter(
        (item) => item.code === CycleSessionCode.LowCadenceForce,
      )) {
        forces.push(ride)
        if (legs) expect(dayGap(legs.weekday, ride.weekday)).toBeGreaterThanOrEqual(2)
      }
    }

    expect(forces.length).toBeGreaterThan(0)
  })

  it('n’en pose jamais deux dans la même semaine', () => {
    for (const week of weeks) {
      const forces = support(week).sessions.filter(
        (item) => item.code === CycleSessionCode.LowCadenceForce,
      )
      expect(forces.length).toBeLessThanOrEqual(1)
    }
  })

  it('ne planifie jamais de sweet spot : douleur seulement (§ 5, R8)', () => {
    for (const week of weeks) {
      const codes = support(week).sessions.map((item) => item.code)
      expect(codes).not.toContain(CycleSessionCode.SweetSpot)
    }
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

  it('G1 — aucune séance jambes la veille d’un jour dur en force et en force-puissance', () => {
    for (const week of weeks.filter((item) => !item.comebackRatio)) {
      const { runs, sessions } = support(week)
      const hard = new Set(
        runs
          .filter((run) => run.key || run.code === RunSessionCode.LongRun)
          .map((run) => run.weekday),
      )

      for (const item of sessions.filter((entry) => entry.sport === Sport.Strength)) {
        if (!strengthSessionType(item.code as StrengthSessionCode).lowerBody) continue
        const next = item.weekday === 7 ? 1 : item.weekday + 1
        expect(hard.has(next)).toBe(false)
      }
    }
  })

  it('G4 — Push et Pull restent plaçables la veille d’une séance clé', () => {
    const placed = weeks.flatMap((week) =>
      support(week).sessions.filter((item) =>
        [StrengthSessionCode.Push, StrengthSessionCode.Pull].includes(
          item.code as StrengthSessionCode,
        ),
      ),
    )
    expect(placed.length).toBeGreaterThan(0)
  })

  it('G7 — une pause sans jambes remplace Legs par une reprise, sans trou', () => {
    const allowances = {
      running: false,
      cycling: true,
      upperBodyStrength: true,
      legStrength: false,
    }
    const sessions = support(weekIn(PhaseType.Development), { allowances }).sessions
    const codes = sessions.map((item) => item.code)

    expect(codes).toContain(StrengthSessionCode.Comeback)
    expect(codes).not.toContain(StrengthSessionCode.Legs)

    // Les autres séances perdent leurs exercices jambes plutôt que de disparaître.
    const push = sessions.find((item) => item.code === StrengthSessionCode.Push)!
    const legExercises = push.prescription.steps.filter(
      (step) => step.exerciseId && strengthExercise(step.exerciseId)?.lowerBody,
    )
    expect(legExercises).toHaveLength(0)
  })

  it('G8 — la force basse cadence reste à 48 h du Legs', () => {
    for (const week of weeks) {
      const { sessions } = support(week)
      const legs = sessions.find((item) => item.code === StrengthSessionCode.Legs)
      const force = sessions.find((item) => item.code === CycleSessionCode.LowCadenceForce)
      if (!legs || !force) continue
      expect(dayGap(legs.weekday, force.weekday)).toBeGreaterThanOrEqual(2)
    }
  })

  it('l’affûtage garde un rappel de force sur les jambes (§ 5)', () => {
    const codes = support(weekIn(PhaseType.Taper)).sessions.map((item) => item.code)
    expect(codes).toContain(StrengthSessionCode.Full)
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

describe('sports déclarés (§ 5)', () => {
  const runsOf = (week: PlanWeek) =>
    buildWeekTemplate({ week, constraints: CONSTRAINTS, vdot: VDOT }).sessions

  const supportWith = (week: PlanWeek, sports: Sport[]) =>
    buildWeekSupport({
      week,
      constraints: { ...CONSTRAINTS, sports },
      runs: runsOf(week),
      weekInPhase: 2,
    })

  it('ne pose aucune séance de soutien quand la course est le seul sport déclaré', () => {
    const week = weekIn(PhaseType.Development)
    const support = supportWith(week, [Sport.Running])

    expect(support.sessions).toEqual([])
    expect(support.targetCyclingMin).toBe(0)
    expect(support.targetStrengthCount).toBe(0)
  })

  it('laisse le volume de course intact quand les sports de soutien disparaissent', () => {
    const week = weekIn(PhaseType.Development)
    const total = runsOf(week).reduce((sum, run) => sum + run.prescription.totalDistanceM, 0)

    supportWith(week, [Sport.Running])
    expect(runsOf(week).reduce((sum, run) => sum + run.prescription.totalDistanceM, 0)).toBe(total)
  })

  it('garde la muscu à sa place habituelle quand seul le vélo n’est pas déclaré', () => {
    const week = weekIn(PhaseType.Development)
    const declared = supportWith(week, [Sport.Running, Sport.Strength])
    const all = supportWith(week, [Sport.Running, Sport.Strength, Sport.Cycling])

    expect(declared.sessions.every((item) => item.sport === Sport.Strength)).toBe(true)
    expect(declared.targetCyclingMin).toBe(0)
    expect(declared.sessions.map((item) => [item.code, item.weekday])).toEqual(
      all.sessions.filter((item) => item.sport === Sport.Strength).map((i) => [i.code, i.weekday]),
    )
  })

  it('vérifie encore le quota de 30 % du spécifique quand le vélo est déclaré', () => {
    const week = weekIn(PhaseType.Specific)
    const runs = runsOf(week)
    const { sessions } = supportWith(week, [Sport.Running, Sport.Strength, Sport.Cycling])
    const units = (list: { prescription: Parameters<typeof prescribedUnits>[0] }[]) =>
      list.reduce((total, item) => total + prescribedUnits(item.prescription), 0)

    const cycling = units(sessions.filter((item) => item.sport === Sport.Cycling))
    expect(cycling).toBeGreaterThan(0)

    const total = units(sessions) + units(runs)
    expect(cycling / total).toBeLessThanOrEqual(CYCLING_MAX_LOAD_SHARE)
  })

  it('pose les trois sports quand rien n’est déclaré : le plan existant ne bouge pas', () => {
    const week = weekIn(PhaseType.Development)
    const sports = new Set(support(week).sessions.map((item) => item.sport))
    expect(sports).toEqual(new Set([Sport.Cycling, Sport.Strength]))
  })
})
