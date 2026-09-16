import { describe, expect, it } from 'vitest'
import { buildPhases } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import { buildWeekTemplate } from '~~/server/domain/plan/week-template'
import { buildWeeks } from '~~/server/domain/plan/weeks'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode, respectsQuota } from '~~/server/domain/running/session-types'

const CONSTRAINTS = {
  availableDays: [1, 2, 3, 5, 6, 7],
  longRunDay: 7,
  easyDays: [1],
}

const PARIS = {
  id: 1,
  name: 'Semi de Paris',
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.Time,
}

const phases = buildPhases('2026-10-05', [PARIS])
const weeks = buildWeeks({ startDate: '2026-10-05', phases, baseWeeklyVolumeM: 25_000 })
const weekIn = (phase: PhaseType) => weeks.find((week) => week.phaseType === phase && !week.light)!

describe('semaine type', () => {
  it('place une séance sur chaque jour disponible, et aucun autre', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Development),
      constraints: CONSTRAINTS,
      vdot: 40,
    })
    expect(sessions.map((session) => session.weekday)).toEqual([1, 2, 3, 5, 6, 7])
  })

  it('garde le lundi facile', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Development),
      constraints: CONSTRAINTS,
      vdot: 40,
    })
    const monday = sessions.find((session) => session.weekday === 1)!
    expect(monday.code).toBe(RunSessionCode.Endurance)
    expect(monday.key).toBe(false)
  })

  it('pose la sortie longue le jour demandé', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Development),
      constraints: CONSTRAINTS,
      vdot: 40,
    })
    const sunday = sessions.find((session) => session.weekday === 7)!
    expect(sunday.code).toBe(RunSessionCode.LongRun)
  })

  it('ne colle jamais deux séances clés sur deux jours consécutifs', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Development),
      constraints: CONSTRAINTS,
      vdot: 40,
    })
    const keyDays = sessions.filter((session) => session.key).map((session) => session.weekday)
    for (let i = 1; i < keyDays.length; i++) {
      expect(keyDays[i]! - keyDays[i - 1]!).toBeGreaterThanOrEqual(2)
    }
  })

  it('n’introduit aucun type interdit dans la phase', () => {
    const base = buildWeekTemplate({
      week: weekIn(PhaseType.Base),
      constraints: CONSTRAINTS,
      vdot: 40,
    })
    expect(base.map((session) => session.code)).not.toContain(RunSessionCode.Vma)
  })

  it('ne prescrit que de l’endurance la première semaine de reprise', () => {
    const sessions = buildWeekTemplate({ week: weeks[0]!, constraints: CONSTRAINTS, vdot: 33.15 })
    expect(new Set(sessions.map((session) => session.code))).toEqual(
      new Set([RunSessionCode.Endurance]),
    )
  })

  it('respecte les quotas sur chaque séance prescrite', () => {
    for (const week of weeks) {
      for (const session of buildWeekTemplate({ week, constraints: CONSTRAINTS, vdot: 40 })) {
        expect(
          respectsQuota(session.code, session.prescription.totalDistanceM, week.targetRunM),
        ).toBe(true)
      }
    }
  })

  it('ne place rien quand aucun jour n’est disponible', () => {
    expect(
      buildWeekTemplate({
        week: weeks[0]!,
        constraints: { availableDays: [] },
        vdot: 40,
      }),
    ).toEqual([])
  })
})
