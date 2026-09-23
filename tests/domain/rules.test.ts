import { describe, expect, it } from 'vitest'
import type { ResolvedForecast } from '~~/server/domain/fitness/accuracy'
import { VDOT_GAIN_PER_BLOCK } from '~~/server/domain/fitness/projection'
import { Sensation } from '~~/server/domain/load/feedback'
import {
  BIAS_MIN_FORECASTS,
  ProposalEffect,
  RuleId,
  evaluateRules,
  type RuleContext,
  type SessionOutcome,
  type UpcomingSession,
} from '~~/server/domain/rules/rules'
import { isOutdated } from '~~/server/domain/rules/proposal-status'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { Sport } from '~~/server/domain/shared/sport'

const TODAY = '2026-11-18'

function outcome(overrides: Partial<SessionOutcome> = {}): SessionOutcome {
  return {
    sessionId: 1,
    date: TODAY,
    sport: Sport.Running,
    code: RunSessionCode.Vma,
    key: true,
    expectedRpe: 8,
    rpe: 8,
    sensations: [],
    sleepHours: 8,
    pain: null,
    paceHeld: true,
    skipped: false,
    ...overrides,
  }
}

function upcoming(overrides: Partial<UpcomingSession> = {}): UpcomingSession {
  return {
    sessionId: 10,
    date: '2026-11-21',
    sport: Sport.Running,
    code: RunSessionCode.Endurance,
    key: false,
    distanceM: 8000,
    repeats: null,
    ...overrides,
  }
}

function context(overrides: Partial<RuleContext> = {}): RuleContext {
  return { today: TODAY, recent: [], upcoming: [], sameDayStrength: [], ...overrides }
}

const idsOf = (proposals: { ruleId: RuleId }[]) => new Set(proposals.map((p) => p.ruleId))

describe('R1 — séance clé trop dure allège la muscu du soir', () => {
  const strength = upcoming({
    sessionId: 20,
    sport: Sport.Strength,
    code: RunSessionCode.Endurance,
    repeats: 4,
  })

  it('déclenche quand le RPE dépasse le prévu d’au moins 1', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ rpe: 9 })], sameDayStrength: [strength] }),
    )
    const r1 = proposals.find((p) => p.ruleId === RuleId.R1)!
    expect(r1.effect).toBe(ProposalEffect.ReduceStrengthSet)
    expect(r1.before).toBe('4 séries')
    expect(r1.after).toContain('3 séries')
  })

  it('ne déclenche pas au RPE prévu', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ rpe: 8 })], sameDayStrength: [strength] }),
    )
    expect(idsOf(proposals).has(RuleId.R1)).toBe(false)
  })
})

describe('R2 — deux signaux de fatigue allègent les faciles', () => {
  const tired = outcome({ rpe: 9, sensations: [Sensation.HeavyLegs] })

  it('déclenche avec deux signaux et réduit de 30 %', () => {
    const proposals = evaluateRules(context({ recent: [tired], upcoming: [upcoming()] }))
    const r2 = proposals.filter((p) => p.ruleId === RuleId.R2)
    expect(r2[0]!.effect).toBe(ProposalEffect.ReduceEasyVolume)
    expect(r2[0]!.after).toContain('5,6 km')
  })

  it('réduit la sortie longue suivante de 10 %', () => {
    const proposals = evaluateRules(
      context({
        recent: [tired],
        upcoming: [upcoming({ sessionId: 11, code: RunSessionCode.LongRun, distanceM: 14000 })],
      }),
    )
    const longRun = proposals.find((p) => p.effect === ProposalEffect.ReduceLongRun)!
    expect(longRun.after).toContain('12,6 km')
  })

  it('ne déclenche pas avec un seul signal', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ rpe: 9 })], upcoming: [upcoming()] }),
    )
    expect(idsOf(proposals).has(RuleId.R2)).toBe(false)
  })
})

describe('R3 — deux nuits courtes retirent une répétition', () => {
  const short = outcome({ sleepHours: 5 })
  const keyNext = upcoming({ sessionId: 12, key: true, code: RunSessionCode.Vma, repeats: 6 })

  it('déclenche à la deuxième nuit sous 6 h', () => {
    const proposals = evaluateRules(
      context({ recent: [short, outcome({ sessionId: 2, sleepHours: 5.5 })], upcoming: [keyNext] }),
    )
    const r3 = proposals.find((p) => p.ruleId === RuleId.R3)!
    expect(r3.after).toContain('5 répétitions')
    expect(r3.after).toContain('allure inchangée')
  })

  it('ne déclenche pas sur une seule nuit courte', () => {
    const proposals = evaluateRules(context({ recent: [short], upcoming: [keyNext] }))
    expect(idsOf(proposals).has(RuleId.R3)).toBe(false)
  })
})

describe('R4 — un signal de fatigue gèle la progression', () => {
  it('déclenche dès un signal', () => {
    const proposals = evaluateRules(context({ recent: [outcome({ sleepHours: 5 })] }))
    expect(proposals.find((p) => p.ruleId === RuleId.R4)!.effect).toBe(
      ProposalEffect.FreezeProgression,
    )
  })

  it('ne déclenche pas sans signal', () => {
    expect(idsOf(evaluateRules(context({ recent: [outcome()] }))).has(RuleId.R4)).toBe(false)
  })
})

describe('R5 — la douleur propose puis impose la pause', () => {
  it('impose la pause dès 4/10', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ pain: { zone: 'genou droit', intensity: 4 } })] }),
    )
    expect(proposals.find((p) => p.ruleId === RuleId.R5)!.effect).toBe(ProposalEffect.ForcePause)
  })

  it('propose la pause après deux séances au-dessus de 3/10', () => {
    const painful = { zone: 'genou droit', intensity: 3.5 }
    const proposals = evaluateRules(
      context({
        recent: [outcome({ pain: painful }), outcome({ sessionId: 2, pain: painful })],
      }),
    )
    expect(proposals.find((p) => p.ruleId === RuleId.R5)!.effect).toBe(ProposalEffect.ProposePause)
  })

  it('ne déclenche pas sur une douleur unique et faible', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ pain: { zone: 'mollet', intensity: 2 } })] }),
    )
    expect(idsOf(proposals).has(RuleId.R5)).toBe(false)
  })
})

describe('R6 — séance clé sautée, replacée seulement si l’écart tient', () => {
  const skipped = outcome({ skipped: true })

  it('déclenche quand la suivante est à plus de 48 h', () => {
    const proposals = evaluateRules(
      context({
        recent: [skipped],
        upcoming: [upcoming({ sessionId: 13, key: true, date: '2026-11-21' })],
      }),
    )
    expect(proposals.find((p) => p.ruleId === RuleId.R6)!.effect).toBe(
      ProposalEffect.RescheduleKeySession,
    )
  })

  it('ne déclenche pas quand la suivante est trop proche', () => {
    const proposals = evaluateRules(
      context({
        recent: [skipped],
        upcoming: [upcoming({ sessionId: 13, key: true, date: '2026-11-19' })],
      }),
    )
    expect(idsOf(proposals).has(RuleId.R6)).toBe(false)
  })
})

describe('R7 — deux séances tenues restaurent la progression', () => {
  it('déclenche sur deux séances clés au RPE prévu, allures tenues', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ rpe: 7 }), outcome({ sessionId: 2, rpe: 8 })] }),
    )
    expect(proposals.find((p) => p.ruleId === RuleId.R7)!.effect).toBe(
      ProposalEffect.RestoreProgression,
    )
  })

  it('ne déclenche pas si une allure n’a pas été tenue', () => {
    const proposals = evaluateRules(
      context({
        recent: [outcome({ rpe: 7, paceHeld: false }), outcome({ sessionId: 2, rpe: 8 })],
      }),
    )
    expect(idsOf(proposals).has(RuleId.R7)).toBe(false)
  })
})

describe('R8 — conversion course vers vélo sur douleur', () => {
  it('déclenche et convertit les séances de course', () => {
    const proposals = evaluateRules(
      context({
        recent: [outcome({ pain: { zone: 'pied', intensity: 5 } })],
        upcoming: [upcoming(), upcoming({ sessionId: 11, code: RunSessionCode.LongRun })],
      }),
    )
    const r8 = proposals.filter((p) => p.ruleId === RuleId.R8)
    expect(r8).toHaveLength(2)
    expect(r8[0]!.effect).toBe(ProposalEffect.ConvertToCycling)
  })

  it('ne déclenche pas sans douleur', () => {
    const proposals = evaluateRules(context({ recent: [outcome()], upcoming: [upcoming()] }))
    expect(idsOf(proposals).has(RuleId.R8)).toBe(false)
  })
})

describe('R9 — le moteur se trompe toujours dans le même sens', () => {
  /** Une prévision à six semaines, résolue avec l'écart qu'on lui donne. */
  function forecast(gap: number): ResolvedForecast {
    return {
      issuedDate: '2026-10-01',
      targetDate: '2026-11-12',
      projectedVdot: 34,
      lowVdot: 33.6,
      highVdot: 34.4,
      actualVdot: 34 + gap,
    }
  }

  const biased = Array.from({ length: BIAS_MIN_FORECASTS }, () => forecast(0.8))

  it('propose de recaler la progression estimée au-delà de cinq comparaisons', () => {
    const proposals = evaluateRules(context({ forecasts: biased }))
    const r9 = proposals.find((p) => p.ruleId === RuleId.R9)!

    expect(r9.effect).toBe(ProposalEffect.AdjustExpectedGain)
    expect(r9.target).toEqual({ kind: 'plan', id: null })
    expect(r9.before).toContain('0,4')
    expect(Number(r9.payload!.gainPerBlock)).toBeGreaterThan(VDOT_GAIN_PER_BLOCK)
    expect(r9.explanation).toContain('+0,8')
  })

  it('ne déclenche pas sous le seuil de comptage', () => {
    const proposals = evaluateRules(context({ forecasts: biased.slice(0, -1) }))
    expect(idsOf(proposals).has(RuleId.R9)).toBe(false)
  })

  it('ne déclenche pas quand les écarts s’annulent', () => {
    const balanced = biased.map((_, index) => forecast(index % 2 === 0 ? 0.8 : -0.8))
    const proposals = evaluateRules(context({ forecasts: balanced }))
    expect(idsOf(proposals).has(RuleId.R9)).toBe(false)
  })

  it('ne propose qu’un seul horizon à la fois', () => {
    const long = Array.from({ length: BIAS_MIN_FORECASTS }, () => ({
      ...forecast(0.8),
      targetDate: '2027-06-01',
    }))
    const proposals = evaluateRules(context({ forecasts: [...biased, ...long] }))
    expect(proposals.filter((p) => p.ruleId === RuleId.R9)).toHaveLength(1)
  })
})

describe('moteur de règles', () => {
  it('écrit ses textes en français : ni point décimal ni date ISO (P19)', () => {
    const tired = outcome({
      rpe: 10,
      sensations: [Sensation.HeavyLegs],
      sleepHours: 5,
      pain: { zone: 'mollet', intensity: 4 },
    })
    const proposals = evaluateRules(
      context({
        recent: [tired, outcome({ sessionId: 2, skipped: true, sleepHours: 5 })],
        upcoming: [
          upcoming({ distanceM: 8300 }),
          upcoming({ sessionId: 11, code: RunSessionCode.LongRun, distanceM: 14700 }),
          upcoming({
            sessionId: 12,
            date: '2026-11-24',
            code: RunSessionCode.Vma,
            key: true,
            repeats: 6,
            expectedRpe: 8,
          }),
        ],
        sameDayStrength: [upcoming({ sessionId: 20, sport: Sport.Strength, repeats: 4 })],
        personal: {
          suppressed: [],
          sleepSensitive: false,
          dayShifts: [{ code: RunSessionCode.Endurance, fromWeekday: 6, toWeekday: 7 }],
          deadWeekdays: [2],
          rpeBias: [{ code: RunSessionCode.Vma, bias: 1 }],
        },
      }),
    )

    const fired = idsOf(proposals)
    for (const id of [
      RuleId.R1,
      RuleId.R2,
      RuleId.R3,
      RuleId.R6,
      RuleId.R8,
      RuleId.R100,
      RuleId.R101,
      RuleId.R102,
    ]) {
      expect(fired.has(id)).toBe(true)
    }
    for (const text of proposals.flatMap((p) => [p.before, p.after, p.explanation])) {
      expect(text).not.toMatch(/\d\.\d/)
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('ne propose rien sur une semaine sans historique', () => {
    expect(evaluateRules(context())).toEqual([])
  })

  it('n’applique jamais rien de lui-même : il ne produit que des propositions', () => {
    const proposals = evaluateRules(
      context({ recent: [outcome({ rpe: 10, sensations: [Sensation.HeavyLegs] })] }),
    )
    for (const proposal of proposals) {
      expect(proposal.before).toBeTruthy()
      expect(proposal.after).toBeTruthy()
      expect(proposal.explanation).toBeTruthy()
    }
  })
})

describe('une proposition ne survit pas à la séance qu’elle vise (P19)', () => {
  const tired = outcome({ rpe: 9, sensations: [Sensation.HeavyLegs] })

  it('expire une proposition de R2 qui visait la séance d’hier', () => {
    const easy = upcoming({ date: '2026-11-21' })
    const r2 = evaluateRules(context({ recent: [tired], upcoming: [easy] })).find(
      (p) => p.ruleId === RuleId.R2,
    )!
    const dates = { targetDate: easy.date, payload: r2.payload ?? null }
    expect(isOutdated(dates, '2026-11-21')).toBe(false)
    expect(isOutdated(dates, '2026-11-22')).toBe(true)
  })

  it('expire une proposition de R6 dont l’échéance est passée', () => {
    const nextKey = upcoming({
      sessionId: 12,
      date: '2026-11-22',
      key: true,
      code: RunSessionCode.LongRun,
    })
    const r6 = evaluateRules(
      context({ recent: [outcome({ skipped: true })], upcoming: [nextKey] }),
    ).find((p) => p.ruleId === RuleId.R6)!
    expect(r6.after).toBe('replacée avant le 22 nov.')
    expect(
      isOutdated({ targetDate: nextKey.date, payload: r6.payload ?? null }, '2026-11-24'),
    ).toBe(true)
  })

  it('expire un déplacement dont le jour d’arrivée est passé', () => {
    expect(
      isOutdated({ targetDate: '2026-11-26', payload: { date: '2026-11-23' } }, '2026-11-24'),
    ).toBe(true)
    expect(isOutdated({ targetDate: null, payload: { date: '2026-11-25' } }, '2026-11-24')).toBe(
      false,
    )
  })
})
