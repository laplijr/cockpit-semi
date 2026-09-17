import { describe, expect, it } from 'vitest'
import { calibrate } from '~~/server/domain/learning/calibration'
import {
  detectDayShift,
  detectDeadSlot,
  detectHabits,
  detectProposalRefusal,
  detectRpeBias,
  detectSleepSensitivity,
  type ObservedDecision,
  type ObservedSession,
} from '~~/server/domain/learning/detectors'
import { HabitType, confidenceOf } from '~~/server/domain/learning/habit'
import { adjustmentsFrom } from '~~/server/domain/learning/personal-rules'
import { ProposalEffect, RuleId, evaluateRules } from '~~/server/domain/rules/rules'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { Sport } from '~~/server/domain/shared/sport'

const session = (overrides: Partial<ObservedSession> = {}): ObservedSession => ({
  code: 'EF',
  weekday: 2,
  done: true,
  skipped: false,
  expectedRpe: 4,
  rpe: 4,
  sleepHours: 7,
  ...overrides,
})

const move = (toWeekday: number): ObservedDecision => ({
  ruleId: 'I1',
  effect: ProposalEffect.MoveSession,
  accepted: true,
  code: 'VMA',
  fromWeekday: 2,
  toWeekday,
})

describe('confiance d’une habitude', () => {
  it('tempère la part observée par la taille de l’échantillon', () => {
    expect(confidenceOf(8, 8, 8)).toBe(0.5)
    expect(confidenceOf(16, 16, 8)).toBe(1)
  })
})

describe('glissement de jour (§ 5)', () => {
  it('se déclenche à huit déplacements dont 60 % vers le même jour', () => {
    const decisions = [...Array(5).fill(move(4)), ...Array(3).fill(move(5))]
    const [habit] = detectDayShift(decisions)

    expect(habit?.type).toBe(HabitType.DayShift)
    expect(habit?.parameters).toMatchObject({ code: 'VMA', fromWeekday: 2, toWeekday: 4 })
  })

  it('ne dit rien sous huit déplacements', () => {
    expect(detectDayShift(Array(7).fill(move(4)))).toEqual([])
  })

  it('ne dit rien quand les déplacements se dispersent', () => {
    const decisions = [...Array(4).fill(move(4)), ...Array(4).fill(move(6))]
    expect(detectDayShift(decisions)).toEqual([])
  })
})

describe('créneau jamais honoré', () => {
  it('se déclenche à huit séances posées et aucune faite', () => {
    const sessions = Array(8).fill(session({ weekday: 5, done: false, skipped: true }))
    expect(detectDeadSlot(sessions)[0]?.parameters).toEqual({ weekday: 5 })
  })

  it('se tait dès qu’une seule a été faite', () => {
    const sessions = [
      ...Array(7).fill(session({ weekday: 5, done: false, skipped: true })),
      session({ weekday: 5 }),
    ]
    expect(detectDeadSlot(sessions)).toEqual([])
  })
})

describe('biais de ressenti', () => {
  it('relève un type de séance systématiquement plus dur que prévu', () => {
    const sessions = Array(6).fill(session({ code: 'seuil', expectedRpe: 6, rpe: 8 }))
    const [habit] = detectRpeBias(sessions)

    expect(habit?.parameters).toEqual({ code: 'seuil', bias: 2 })
  })

  it('ignore un écart moyen inférieur à un demi-point', () => {
    const sessions = [
      ...Array(3).fill(session({ code: 'seuil', expectedRpe: 6, rpe: 6 })),
      ...Array(3).fill(session({ code: 'seuil', expectedRpe: 6, rpe: 6.5 })),
    ]
    expect(detectRpeBias(sessions)).toEqual([])
  })
})

describe('sensibilité au sommeil', () => {
  it('se déclenche à cinq nuits courtes payées d’un point de RPE', () => {
    const sessions = Array(5).fill(session({ sleepHours: 5, expectedRpe: 5, rpe: 7 }))
    expect(detectSleepSensitivity(sessions)[0]?.type).toBe(HabitType.SleepSensitivity)
  })

  it('se tait quand les nuits courtes ne coûtent rien', () => {
    const sessions = Array(6).fill(session({ sleepHours: 5, expectedRpe: 5, rpe: 5 }))
    expect(detectSleepSensitivity(sessions)).toEqual([])
  })
})

describe('refus systématique', () => {
  it('relève une famille refusée au moins 70 % du temps sur cinq décisions', () => {
    const decisions: ObservedDecision[] = [
      ...Array(4).fill({ ...move(4), accepted: false }),
      { ...move(4), accepted: true },
    ]
    const [habit] = detectProposalRefusal(decisions)

    expect(habit?.parameters).toEqual({ ruleId: 'I1', effect: ProposalEffect.MoveSession })
  })
})

describe('habitudes acceptées devenues règles (§ 5, R100+)', () => {
  const upcoming = [
    {
      sessionId: 1,
      date: '2026-11-24',
      sport: Sport.Running,
      code: RunSessionCode.Vma,
      key: true,
      distanceM: 8000,
      repeats: 6,
      expectedRpe: 8,
    },
  ]

  const context = (personal: ReturnType<typeof adjustmentsFrom>) => ({
    today: '2026-11-22',
    recent: [],
    upcoming,
    sameDayStrength: [],
    personal,
  })

  it('replace la séance du jour prévu au jour tenu, la date dans le payload', () => {
    const personal = adjustmentsFrom([
      { type: HabitType.DayShift, parameters: { code: 'VMA', fromWeekday: 2, toWeekday: 4 } },
    ])

    const [proposal] = evaluateRules(context(personal))
    expect(proposal?.ruleId).toBe(RuleId.R100)
    expect(proposal?.payload).toEqual({ date: '2026-11-26' })
  })

  it('vide un créneau mort en déplaçant vers le jour suivant vivant', () => {
    const personal = adjustmentsFrom([
      { type: HabitType.DeadSlot, parameters: { weekday: 2 } },
      { type: HabitType.DeadSlot, parameters: { weekday: 3 } },
    ])

    const [proposal] = evaluateRules(context(personal))
    expect(proposal?.ruleId).toBe(RuleId.R101)
    expect(proposal?.payload).toEqual({ date: '2026-11-26' })
  })

  it('recale le RPE attendu sans toucher à la séance', () => {
    const personal = adjustmentsFrom([
      { type: HabitType.RpeBias, parameters: { code: 'VMA', bias: -1 } },
    ])

    const [proposal] = evaluateRules(context(personal))
    expect(proposal?.effect).toBe(ProposalEffect.AdjustExpectedRpe)
    expect(proposal?.payload).toEqual({ expectedRpe: 7 })
  })

  it('tait une famille refusée systématiquement, sans toucher aux autres règles', () => {
    const personal = adjustmentsFrom([
      { type: HabitType.DayShift, parameters: { code: 'VMA', fromWeekday: 2, toWeekday: 4 } },
      {
        type: HabitType.ProposalRefusal,
        parameters: { ruleId: RuleId.R100, effect: ProposalEffect.MoveSession },
      },
    ])

    expect(evaluateRules(context(personal))).toEqual([])
  })

  it('ne change rien quand aucune habitude n’est acceptée', () => {
    expect(evaluateRules(context(adjustmentsFrom([])))).toEqual([])
  })
})

describe('détection groupée', () => {
  it('rend une clé stable par sujet, pour que deux passages ne s’empilent pas', () => {
    const input = {
      sessions: Array(8).fill(session({ weekday: 5, done: false, skipped: true })),
      decisions: [],
    }

    const first = detectHabits(input).map((habit) => habit.key)
    const second = detectHabits(input).map((habit) => habit.key)
    expect(first).toEqual(second)
  })
})

describe('calibration hebdomadaire (§ 5)', () => {
  it('mesure l’écart de RPE, le taux d’acceptation et l’écart de projection', () => {
    const result = calibrate({
      date: '2026-11-16',
      rpe: [
        { expected: 5, felt: 6 },
        { expected: 6, felt: 6 },
      ],
      decisions: [{ accepted: true }, { accepted: false }, { accepted: true }],
      tests: [{ projected: 34, measured: 33.2 }],
    })

    expect(result.rpeError).toBe(0.5)
    expect(result.acceptanceRate).toBe(0.67)
    expect(result.projectionGap).toBe(0.8)
    expect(result.samples).toEqual({ rpe: 2, decisions: 3, tests: 1 })
  })

  it('laisse les mesures nulles plutôt que d’inventer un zéro', () => {
    const result = calibrate({ date: '2026-11-16', rpe: [], decisions: [], tests: [] })

    expect(result.acceptanceRate).toBeNull()
    expect(result.projectionGap).toBeNull()
  })
})
