import { describe, expect, it } from 'vitest'
import { generatePlan, nextSessionAfter, sessionsOn } from '~~/server/domain/plan/generate'
import { addDays } from '~~/server/domain/plan/calendar'
import { PhaseType } from '~~/server/domain/plan/phases'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { TrainingZone, paceFor } from '~~/server/domain/fitness/vdot'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { EASY_MIN_MIN } from '~~/server/domain/plan/week-template'

const CONSTRAINTS = { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] }

const RACES = [
  {
    id: 1,
    name: 'Semi de Paris',
    date: '2027-03-07',
    distanceM: 21097.5,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
  },
  {
    id: 2,
    name: 'Semi de Madrid',
    date: '2027-04-04',
    distanceM: 21097.5,
    priority: RacePriority.B,
    objectiveMode: ObjectiveMode.Time,
  },
  {
    id: 3,
    name: '5 km Île d’Arz',
    date: '2027-08-08',
    distanceM: 5000,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
  },
]

const BASE = {
  today: '2026-09-16',
  constraints: CONSTRAINTS,
  races: RACES,
  baseWeeklyVolumeM: 20_000,
  peakWeeklyVolumeM: 45_000,
  vdot: 33.15,
}

describe('génération du plan complet', () => {
  it('couvre le calendrier jusqu’à la dernière course', () => {
    const plan = generatePlan(BASE)
    expect(plan.weeks.at(-1)!.raceId).toBe(3)
    expect(plan.weeks.at(-1)!.phaseType).toBe(PhaseType.Taper)
  })

  it('se cale sur la reprise estimée quand une pause est ouverte', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-05' },
    })
    expect(plan.startDate).toBe('2026-10-05')
    expect(plan.provisional).toBe(true)
    expect(plan.weeks[0]!.comebackRatio).toBe(0.6)
  })

  it('ne déclenche pas de reprise surveillée sans pause', () => {
    const plan = generatePlan(BASE)
    expect(plan.provisional).toBe(false)
    expect(plan.weeks[0]!.comebackRatio).toBeUndefined()
  })

  it('ne démarre jamais dans le passé, même si la reprise estimée est dépassée', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-08-01', estimatedEndDate: '2026-08-20' },
    })
    expect(plan.startDate).toBe('2026-09-16')
  })

  it('ignore les courses déjà passées', () => {
    const plan = generatePlan({
      ...BASE,
      races: [
        {
          id: 9,
          name: 'Semi du 13 sept.',
          date: '2026-09-13',
          distanceM: 21500,
          priority: RacePriority.A,
          objectiveMode: ObjectiveMode.Time,
        },
        ...RACES,
      ],
    })
    expect(plan.phases.some((phase) => phase.raceId === 9)).toBe(false)
  })

  it('retrouve les séances d’un jour et la suivante', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-05' },
    })
    const monday = sessionsOn(plan, '2026-10-05')
    expect(monday).toHaveLength(1)
    expect(monday[0]!.code).toBe(RunSessionCode.Endurance)
    expect(nextSessionAfter(plan, '2026-10-05')!.date).toBe('2026-10-06')
  })

  it('ne planifie aucune séance avant la date de départ', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-07' },
    })
    for (const week of plan.weeks) {
      for (const session of week.sessions) {
        expect(session.date >= plan.startDate).toBe(true)
      }
    }
  })
})

describe('règles de placement (§ 5)', () => {
  const plan = generatePlan({
    ...BASE,
    openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-05' },
  })
  const allSessions = plan.weeks.flatMap((week) => week.sessions)
  /** Vélo et muscu compris : un jour bloqué l'est pour les trois sports (§ 5). */
  const everything = plan.weeks.flatMap((week) => [...week.sessions, ...week.support])

  it('ne pose aucune séance un jour de course', () => {
    for (const date of ['2027-03-07', '2027-04-04', '2027-08-08']) {
      expect(everything.filter((session) => session.date === date)).toEqual([])
    }
  })

  it('laisse le lendemain d’une course A en repos', () => {
    for (const date of ['2027-03-08', '2027-08-09']) {
      expect(everything.filter((session) => session.date === date)).toEqual([])
    }
  })

  it('laisse la veille d’une course qui structure le plan en repos', () => {
    for (const date of ['2027-03-06', '2027-04-03', '2027-08-07']) {
      expect(everything.filter((session) => session.date === date)).toEqual([])
    }
  })

  it('pose une endurance courte l’avant-veille d’une course', () => {
    const cap = (EASY_MIN_MIN * 60 * 1000) / paceFor(BASE.vdot, TrainingZone.Easy)

    for (const date of ['2027-03-05', '2027-04-02', '2027-08-06']) {
      const onThatDay = allSessions.filter((session) => session.date === date)
      expect(onThatDay).toHaveLength(1)
      expect(onThatDay[0]!.code).toBe(RunSessionCode.Endurance)
      expect(onThatDay[0]!.prescription.totalDistanceM).toBeLessThan(cap)
    }
  })

  it('ne dépasse jamais deux séances clés hors sortie longue', () => {
    for (const week of plan.weeks) {
      const keys = week.sessions.filter((s) => s.key && s.code !== RunSessionCode.LongRun)
      expect(keys.length).toBeLessThanOrEqual(2)
    }
  })

  it('place un test 20′ en semaine 4 de reprise', () => {
    const week = plan.weeks[3]!
    expect(week.test).toBe(true)
    expect(week.sessions.map((session) => session.code)).toContain(RunSessionCode.Test)
  })

  it('borne la sortie longue du cycle 5 km à 75′ d’endurance', () => {
    const cap = (75 * 60 * 1000) / paceFor(BASE.vdot, TrainingZone.Easy)
    const shortCycle = plan.weeks.filter((week) => week.raceId === 3)
    const longRuns = shortCycle.flatMap((week) =>
      week.sessions.filter((session) => session.code === RunSessionCode.LongRun),
    )
    expect(longRuns.length).toBeGreaterThan(0)
    for (const run of longRuns) {
      expect(run.prescription.totalDistanceM).toBeLessThanOrEqual(Math.round(cap) + 1)
    }
  })
})

describe('plafond de pic de la sortie longue (§ 5, P23)', () => {
  // Départ un lundi, sous reprise : aucune semaine partielle, montée 60 / 80 / 100 %.
  const plan = generatePlan({
    ...BASE,
    today: '2026-09-14',
    openPause: { startDate: '2026-09-01', estimatedEndDate: '2026-09-14' },
  })
  const runs = plan.weeks.flatMap((week) => week.sessions)

  it('ne dépasse jamais de plus de 10 % la plus longue course des 30 jours d’avant', () => {
    for (const week of plan.weeks.slice(1)) {
      const from = addDays(week.startDate, -30)
      const before = runs
        .filter((run) => run.date >= from && run.date < week.startDate)
        .map((run) => run.prescription.totalDistanceM)
      const longRun = week.sessions.find((session) => session.code === RunSessionCode.LongRun)
      if (!longRun || before.length === 0) continue
      expect(longRun.prescription.totalDistanceM).toBeLessThanOrEqual(
        Math.round(Math.max(...before) * 1.1),
      )
    }
  })

  it('compte les courses faites avant le plan dans la référence', () => {
    const longRunOfWeek2 = (recentRuns: { date: string; distanceM: number }[]) =>
      generatePlan({
        ...BASE,
        today: '2026-09-14',
        openPause: { startDate: '2026-09-01', estimatedEndDate: '2026-09-14' },
        recentRuns,
      }).weeks[1]!.sessions.find((session) => session.code === RunSessionCode.LongRun)!.prescription
        .totalDistanceM
    const planOnly = longRunOfWeek2([])
    const withDone = longRunOfWeek2([{ date: '2026-08-30', distanceM: 12_000 }])
    expect(withDone).toBeGreaterThan(planOnly)
    expect(withDone).toBeLessThanOrEqual(13_200)
  })

  it('n’annonce jamais pour une semaine réduite plus que ses courses', () => {
    const capped = plan.weeks.filter((week) => week.volumeCapped && week.sessions.length > 0)
    const posed = (week: (typeof capped)[number]) =>
      week.sessions.reduce((sum, run) => sum + run.prescription.totalDistanceM, 0)
    expect(capped.length).toBeGreaterThan(0)
    for (const week of capped) expect(week.targetRunM).toBeLessThanOrEqual(posed(week))
    expect(capped.some((week) => week.targetRunM === posed(week))).toBe(true)
  })
})

describe('sortie longue en affûtage (§ 5, P24)', () => {
  const plan = generatePlan({ ...BASE, today: '2026-09-14' })
  const longRunOf = (week: (typeof plan.weeks)[number]) =>
    week.sessions.find((session) => session.code === RunSessionCode.LongRun)?.prescription
      .totalDistanceM

  it('réduit la sortie longue comme le volume, depuis la dernière semaine pleine', () => {
    const tapers = plan.weeks.filter((week) => week.phaseType === PhaseType.Taper)
    expect(tapers.length).toBeGreaterThan(0)
    for (const taper of tapers) {
      const longRun = longRunOf(taper)
      if (longRun === undefined) continue
      const full = plan.weeks
        .filter(
          (week) =>
            week.index < taper.index &&
            !week.light &&
            ![PhaseType.Taper, PhaseType.Recovery].includes(week.phaseType) &&
            longRunOf(week) !== undefined,
        )
        .at(-1)!
      const ratio = taper.targetRunM / full.targetRunM
      expect(longRun).toBeLessThanOrEqual(Math.round(longRunOf(full)! * ratio) + 1)
    }
  })

  it('ne pose plus 21 km la semaine d’avant le semi de Paris', () => {
    const before = plan.weeks.find((week) => week.endDate === '2027-02-28')!
    expect(longRunOf(before) ?? 0).toBeLessThan(14_000)
  })
})

describe('pause ouverte sans date de reprise (§ 5)', () => {
  const plan = generatePlan({
    ...BASE,
    openPause: { startDate: '2026-09-16', estimatedEndDate: null },
  })

  it('génère des semaines non datées, sans date de départ', () => {
    expect(plan.startDate).toBeNull()
    expect(plan.provisional).toBe(true)
    expect(plan.weeks.length).toBeGreaterThan(0)
  })

  it('ne pose aucune séance tant que la reprise n’est pas marquée', () => {
    expect(plan.weeks.every((week) => week.sessions.length === 0)).toBe(true)
  })

  it('conserve les phases et les volumes', () => {
    expect(plan.phases.length).toBeGreaterThan(0)
    expect(plan.weeks.every((week) => week.targetRunM > 0)).toBe(true)
  })
})

describe('plan sans course et sans point de forme (§ 5)', () => {
  it('produit un cycle d’entretien de douze semaines pleines quand aucune course n’est inscrite', () => {
    const plan = generatePlan({ ...BASE, races: [] })

    expect(plan.weeks).toHaveLength(12)
    expect(plan.weeks.every((week) => week.sessions.length > 0)).toBe(true)
    expect(plan.weeks.every((week) => week.raceId === null)).toBe(true)
  })

  it('ne prescrit aucune allure de qualité avant le test quand le VDOT est inconnu', () => {
    const plan = generatePlan({ ...BASE, races: [], vdotKnown: false })
    const [first, second] = plan.weeks

    expect(first!.sessions.map((session) => session.code)).toEqual(
      first!.sessions.map(() => RunSessionCode.Endurance),
    )
    expect(first!.sessions.every((session) => !session.key)).toBe(true)
    expect(second!.sessions.some((session) => session.code === RunSessionCode.Test)).toBe(true)
  })
})
