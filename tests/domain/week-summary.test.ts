import { describe, expect, it } from 'vitest'
import {
  conformingStreak,
  isConforming,
  progressCounters,
  summariseWeek,
  type CountedSession,
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
  key: false,
  longRun: false,
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

  it('ne compte pas faite une séance modifiée qui n’a pas eu lieu (P28)', () => {
    const summary = summariseWeek(
      week,
      [],
      [run(), run({ status: SessionStatus.Modified, actualDistanceM: null })],
    )!

    expect(summary.sessionsDone).toBe(1)
    expect(summary.sessionsPlanned).toBe(2)
  })

  it('ne compte pas au prévu une séance retirée d’avance (P28)', () => {
    const summary = summariseWeek(
      week,
      [],
      [run(), run({ status: SessionStatus.Cancelled, actualDistanceM: null, longRun: true })],
    )!

    expect(summary.sessionsPlanned).toBe(1)
    expect(summary.longRun.planned).toBe(0)
    expect(isConforming(summary)).toBe(true)
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

describe('compteurs et série depuis la reprise (§ 9, P6.5)', () => {
  const done = (over: Partial<CountedSession> = {}): CountedSession => ({
    status: SessionStatus.Done,
    sport: Sport.Running,
    code: 'EF',
    actualDistanceM: 8000,
    elevationGainM: null,
    ...over,
  })

  const summary = (
    sessionsDone: number,
    light = false,
    sessionsPlanned = 5,
    keyDone = { longRun: 1, quality: 1 },
  ) => ({
    targetRunM: 40000,
    actualRunM: 38_000,
    runGapM: -2000,
    loadUa: 300,
    loadBySport: {
      [Sport.Running]: 300,
      [Sport.Cycling]: 0,
      [Sport.Strength]: 0,
      [Sport.Other]: 0,
    },
    sessionsPlanned,
    sessionsDone,
    longRun: { planned: 1, done: keyDone.longRun },
    quality: { planned: 1, done: keyDone.quality },
    light,
    test: false,
    comeback: false,
  })

  it('cumule ce qui a été fait, et ne compte pas ce qui ne l’a pas été', () => {
    const counters = progressCounters(
      [
        done({ actualDistanceM: 10_000, code: 'SL' }),
        done({ actualDistanceM: 8000 }),
        done({ status: SessionStatus.Skipped, actualDistanceM: 9000 }),
        done({ sport: Sport.Cycling, actualDistanceM: null }),
      ],
      [],
      'SL',
    )

    expect(counters).toMatchObject({ runM: 18_000, sessions: 3, longRuns: 1 })
  })

  it('ajoute une semaine à la série quand le plan est tenu', () => {
    const weeks = [summary(4), summary(5)].map((item) => ({ summary: item, excused: false }))

    expect(conformingStreak(weeks)).toBe(2)
  })

  it('gèle la série sur une semaine allégée au lieu de la casser', () => {
    const weeks = [
      { summary: summary(4), excused: false },
      { summary: summary(1, true), excused: false },
      { summary: summary(5), excused: false },
    ]

    expect(conformingStreak(weeks)).toBe(2)
  })

  it('gèle aussi sur une semaine couverte par une pause', () => {
    const weeks = [
      { summary: summary(4), excused: false },
      { summary: summary(1), excused: true },
      { summary: summary(5), excused: false },
    ]

    expect(conformingStreak(weeks)).toBe(2)
  })

  it('remet la série à zéro sur une semaine ratée sans cause', () => {
    const weeks = [
      { summary: summary(2), excused: false },
      { summary: summary(5), excused: false },
    ]

    expect(conformingStreak(weeks)).toBe(0)
  })

  it('s’arrête à une semaine à venir plutôt que de la compter tenue', () => {
    expect(conformingStreak([{ summary: summary(0, false, 0), excused: false }])).toBe(0)
  })

  it('juge une semaine tenue à quatre séances sur cinq', () => {
    expect(isConforming(summary(4))).toBe(true)
    expect(isConforming(summary(3))).toBe(false)
  })

  it('ne dit pas tenue une semaine sans sa sortie longue ni sa séance clé (P19)', () => {
    expect(isConforming(summary(7, false, 8, { longRun: 0, quality: 1 }))).toBe(false)
    expect(isConforming(summary(7, false, 8, { longRun: 1, quality: 0 }))).toBe(false)
    expect(isConforming(summary(7, false, 8, { longRun: 1, quality: 1 }))).toBe(true)
  })

  it('n’exige pas ce que la semaine ne prévoyait pas', () => {
    const easy = summariseWeek(week, [], [run(), run(), run(), run()])!
    expect(easy.longRun.planned).toBe(0)
    expect(easy.quality.planned).toBe(0)
    expect(isConforming(easy)).toBe(true)
  })

  it('casse la série sur une semaine sans séance clé, par la même règle', () => {
    const weeks = [
      { summary: summary(5, false, 5, { longRun: 1, quality: 0 }), excused: false },
      { summary: summary(5), excused: false },
    ]
    expect(conformingStreak(weeks)).toBe(0)
  })
})
