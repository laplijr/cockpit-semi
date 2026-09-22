import { describe, expect, it } from 'vitest'
import { TrainingZone, paceFor } from '~~/server/domain/fitness/vdot'
import { buildPhases } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import { EASY_MIN_MIN, buildWeekTemplate } from '~~/server/domain/plan/week-template'
import { buildWeeks } from '~~/server/domain/plan/weeks'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import {
  QuotaBasis,
  RunSessionCode,
  quotaBasisFor,
  respectsQuota,
} from '~~/server/domain/running/session-types'

const CONSTRAINTS = { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] }
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

/** Première semaine pleine de la phase, hors reprise surveillée et hors semaine allégée. */
const weekIn = (phase: PhaseType) =>
  weeks.find(
    (week) => week.phaseType === phase && !week.light && !week.comebackRatio && !week.test,
  )!
const template = (week: (typeof weeks)[number]) =>
  buildWeekTemplate({ week, constraints: CONSTRAINTS, vdot: VDOT })

describe('nombre de courses par semaine (§ 5)', () => {
  it('pose trois courses pendant la reprise surveillée', () => {
    expect(template(weeks[0]!).sessions).toHaveLength(3)
    expect(template(weeks[1]!).sessions).toHaveLength(3)
  })

  it('pose quatre courses en base, dont un progressif', () => {
    const sessions = template(weekIn(PhaseType.Base)).sessions
    expect(sessions).toHaveLength(4)
    expect(sessions.map((item) => item.code)).toContain(RunSessionCode.Progressive)
  })

  it('pose quatre courses en développement, dont une séance de qualité', () => {
    const sessions = template(weekIn(PhaseType.Development)).sessions
    expect(sessions).toHaveLength(4)
    const quality = sessions.filter((item) =>
      [RunSessionCode.Vma, RunSessionCode.Threshold].includes(item.code),
    )
    expect(quality.length).toBeGreaterThanOrEqual(1)
  })

  it('pose quatre courses en spécifique, dont le seuil', () => {
    const sessions = template(weekIn(PhaseType.Specific)).sessions
    expect(sessions).toHaveLength(4)
    expect(sessions.map((item) => item.code)).toContain(RunSessionCode.Threshold)
  })

  it('pose trois courses en affûtage', () => {
    expect(template(weekIn(PhaseType.Taper)).sessions).toHaveLength(3)
  })

  it('ne pose jamais plus de courses que de jours disponibles', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Development),
      constraints: { availableDays: [2, 4], longRunDay: 4 },
      vdot: VDOT,
    }).sessions
    expect(sessions.length).toBeLessThanOrEqual(2)
  })

  it('suit le nombre demandé dans le profil quand il est renseigné', () => {
    const sessions = buildWeekTemplate({
      week: weekIn(PhaseType.Base),
      constraints: { ...CONSTRAINTS, runsPerWeek: 6 },
      vdot: VDOT,
    }).sessions
    expect(sessions).toHaveLength(6)
  })

  it('ne laisse pas le nombre du profil défaire l’affûtage ni la reprise', () => {
    const reducing = [weekIn(PhaseType.Taper), weeks.find((week) => week.comebackRatio === 0.6)!]

    for (const week of reducing) {
      const sessions = buildWeekTemplate({
        week,
        constraints: { ...CONSTRAINTS, runsPerWeek: 6 },
        vdot: VDOT,
      }).sessions
      expect(sessions).toHaveLength(week.runs)
    }
  })
})

describe('placement', () => {
  const sessions = template(weekIn(PhaseType.Specific)).sessions

  it('pose la sortie longue le jour demandé', () => {
    expect(sessions.find((item) => item.weekday === 7)?.code).toBe(RunSessionCode.LongRun)
  })

  it('ne colle jamais deux séances clés sur deux jours consécutifs', () => {
    const keyDays = sessions.filter((item) => item.key).map((item) => item.weekday)
    for (let i = 1; i < keyDays.length; i++) {
      expect(keyDays[i]! - keyDays[i - 1]!).toBeGreaterThanOrEqual(2)
    }
  })

  it('laisse au moins un jour vide quand il y a moins de courses que de jours', () => {
    const used = new Set(sessions.map((item) => item.weekday))
    const freeDays = CONSTRAINTS.availableDays.filter((day) => !used.has(day))
    expect(freeDays.length).toBeGreaterThanOrEqual(1)
  })

  /** La semaine boucle : la veille du lundi est le dimanche, pas le jour 0. */
  const dayBefore = (day: number) => (day === 1 ? 7 : day - 1)

  it('évite de poser une endurance au lendemain d’une séance dure', () => {
    const used = new Map(sessions.map((item) => [item.weekday, item.key]))
    for (const [day, isKey] of used) {
      if (isKey || !used.get(dayBefore(day))) continue
      // Un lendemain de séance dure n'est occupé que si aucun autre jour ne restait.
      const free = CONSTRAINTS.availableDays.filter((candidate) => !used.has(candidate))
      expect(free.every((candidate) => used.get(dayBefore(candidate)) === true)).toBe(true)
    }
  })

  it('laisse le lendemain de la sortie longue du dimanche libre sur tout le cycle', () => {
    for (const week of weeks) {
      const placed = template(week).sessions
      const longRun = placed.find((item) => item.code === RunSessionCode.LongRun)
      if (longRun?.weekday !== 7) continue

      const monday = placed.find((item) => item.weekday === 1)
      if (!monday) continue

      // Le lundi n'est occupé que si plus aucun jour n'était libre.
      const used = new Set(placed.map((item) => item.weekday))
      const free = CONSTRAINTS.availableDays.filter((day) => !used.has(day))
      expect(free).toHaveLength(0)
    }
  })

  it('ne prescrit que de l’endurance la première semaine de reprise', () => {
    const codes = template(weeks[0]!).sessions.map((item) => item.code)
    expect(new Set(codes)).toEqual(new Set([RunSessionCode.Endurance]))
  })
})

describe('rôle de chaque course', () => {
  it('ne pose jamais de séance « allure semi » isolée', () => {
    for (const week of weeks) {
      const codes = template(week).sessions.map((item) => item.code)
      expect(codes).not.toContain(RunSessionCode.HalfPace)
    }
  })

  it('met l’allure semi dans la sortie longue en phase spécifique', () => {
    const longRun = template(weekIn(PhaseType.Specific)).sessions.find(
      (item) => item.code === RunSessionCode.LongRun,
    )!
    expect(longRun.prescription.steps.some((step) => step.intense)).toBe(true)
  })

  it('n’ajoute jamais de séance de lignes droites séparée', () => {
    for (const week of weeks) {
      const codes = template(week).sessions.map((item) => item.code)
      expect(codes).not.toContain(RunSessionCode.Strides)
    }
  })

  it('intègre les lignes droites à au plus deux endurances', () => {
    const withStrides = template(weekIn(PhaseType.Base)).sessions.filter((item) =>
      item.prescription.steps.some((step) => step.label === 'Lignes droites'),
    )
    expect(withStrides.length).toBeLessThanOrEqual(2)
  })
})

describe('durées et volume', () => {
  it('ne descend jamais une endurance sous 35 minutes dès que la semaine peut la porter', () => {
    const floor = (EASY_MIN_MIN * 60 * 1000) / paceFor(VDOT, TrainingZone.Easy)
    for (const week of weeks.filter((item) => item.targetRunM >= 25_000)) {
      for (const item of template(week).sessions) {
        if (item.code !== RunSessionCode.Endurance) continue
        expect(item.prescription.totalDistanceM).toBeGreaterThanOrEqual(Math.round(floor) - 1)
      }
    }
  })

  it('ne dépasse jamais le volume de la semaine de plus de 15 %', () => {
    for (const week of weeks) {
      const total = template(week).sessions.reduce(
        (sum, item) => sum + item.prescription.totalDistanceM,
        0,
      )
      expect(total).toBeLessThanOrEqual(week.targetRunM * 1.15)
    }
  })

  it('respecte les quotas sur chaque séance prescrite', () => {
    for (const week of weeks) {
      for (const item of template(week).sessions) {
        const measured =
          quotaBasisFor(item.code) === QuotaBasis.Total
            ? item.prescription.totalDistanceM
            : item.prescription.qualityDistanceM
        expect(respectsQuota(item.code, measured, week.targetRunM)).toBe(true)
      }
    }
  })

  it('signale une semaine dont le volume a dû être réduit', () => {
    const capped = buildWeekTemplate({
      week: { ...weekIn(PhaseType.Base), targetRunM: 90_000, longRunMaxM: 27_000 },
      constraints: CONSTRAINTS,
      vdot: VDOT,
    })
    expect(capped.volumeCapped).toBe(true)
  })

  it('ne place rien quand aucun jour n’est disponible', () => {
    expect(
      buildWeekTemplate({ week: weeks[0]!, constraints: { availableDays: [] }, vdot: VDOT })
        .sessions,
    ).toEqual([])
  })
})
