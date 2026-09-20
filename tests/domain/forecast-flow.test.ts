import { describe, expect, it } from 'vitest'
import {
  issueForecasts,
  nextTestDate,
  resolveForecasts,
  type ForecastInput,
} from '~~/server/application/record-forecasts'
import type { ForecastContext } from '~~/server/application/ports'
import { ForecastTarget } from '~~/server/domain/fitness/accuracy'
import { vdotFromRace } from '~~/server/domain/fitness/vdot'
import type { GeneratedPlan } from '~~/server/domain/plan/generate'
import { RunSessionCode } from '~~/server/domain/running/session-types'

const TODAY = '2026-11-22'

function context(overrides: Partial<ForecastContext> = {}): ForecastContext {
  return {
    tests: [
      { date: '2026-10-19', vdot: 33.6 },
      { date: '2026-11-16', vdot: 34.2 },
    ],
    races: [],
    open: [],
    ...overrides,
  }
}

function input(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    today: TODAY,
    fitness: { vdot: 34.2, isFloor: false, date: '2026-11-16' },
    gainPerBlock: 0.4,
    nextTestDate: '2026-12-21',
    openPause: undefined,
    ...overrides,
  }
}

const race = {
  id: 7,
  date: '2027-03-07',
  distanceM: 21_097.5,
  elevationGainM: null,
  expectedTempC: null,
  targetS: 8100,
  resultS: null,
}

describe('émission des prévisions (§ 9, P6.6)', () => {
  it('annonce une ligne pour le prochain test et une par course à venir', () => {
    const issued = issueForecasts(context({ races: [race] }), input())

    expect(issued.map((item) => item.target)).toEqual([ForecastTarget.Test, ForecastTarget.Race])
    expect(issued[0]!.targetDate).toBe('2026-12-21')
    expect(issued[1]!.raceId).toBe(7)
  })

  it('n’annonce rien sans point de forme : il n’y a rien à projeter', () => {
    expect(issueForecasts(context({ races: [race] }), input({ fitness: undefined }))).toEqual([])
  })

  it('laisse la confiance vide sur un test, et la remplit sur une course visée', () => {
    const issued = issueForecasts(context({ races: [race] }), input())

    expect(issued[0]!.confidencePct).toBeNull()
    expect(issued[1]!.confidencePct).toBeGreaterThan(0)
  })

  it('ignore une course déjà courue et une course du jour même', () => {
    const past = { ...race, id: 8, date: '2026-09-13', resultS: 8760 }
    const issued = issueForecasts(context({ races: [past] }), input({ nextTestDate: null }))

    expect(issued).toEqual([])
  })

  it('encadre la projection et la fait monter avec l’horizon', () => {
    const [test] = issueForecasts(context(), input())
    const [far] = issueForecasts(context(), input({ nextTestDate: '2027-06-21' }))

    expect(test!.lowVdot).toBeLessThan(test!.projectedVdot)
    expect(test!.highVdot).toBeGreaterThan(test!.projectedVdot)
    expect(far!.projectedVdot).toBeGreaterThan(test!.projectedVdot)
  })

  it('ne fait pas progresser une projection couverte par une pause ouverte', () => {
    const paused = issueForecasts(context(), input({ openPause: { estimatedEndDate: null } }))

    expect(paused[0]!.projectedVdot).toBeCloseTo(34.2, 6)
  })
})

describe('résolution des prévisions (§ 9, P6.6)', () => {
  const openTest = {
    id: 1,
    target: ForecastTarget.Test,
    raceId: null,
    issuedDate: '2026-10-25',
    projectedVdot: 33.9,
  }

  it('résout une prévision de test au premier test passé depuis son émission', () => {
    const [resolved] = resolveForecasts(context({ open: [openTest] }))

    expect(resolved!.actualVdot).toBe(34.2)
    expect(resolved!.resolvedDate).toBe('2026-11-16')
    expect(resolved!.gapVdot).toBeCloseTo(0.3, 6)
  })

  it('laisse ouverte une prévision qu’aucun test n’a encore rattrapée', () => {
    const later = { ...openTest, issuedDate: '2026-11-20' }
    expect(resolveForecasts(context({ open: [later] }))).toEqual([])
  })

  it('résout une prévision de course au chrono de cette course', () => {
    const raced = { ...race, resultS: 8100 }
    const open = {
      id: 2,
      target: ForecastTarget.Race,
      raceId: 7,
      issuedDate: '2026-11-01',
      projectedVdot: 34.6,
    }

    const [resolved] = resolveForecasts(context({ races: [raced], open: [open] }))

    expect(resolved!.actualVdot).toBeCloseTo(vdotFromRace(21_097.5, 8100), 6)
    expect(resolved!.resolvedDate).toBe(raced.date)
  })

  it('laisse ouverte une prévision dont la course n’a pas encore eu lieu', () => {
    const open = {
      id: 3,
      target: ForecastTarget.Race,
      raceId: 7,
      issuedDate: '2026-11-01',
      projectedVdot: 34.6,
    }

    expect(resolveForecasts(context({ races: [race], open: [open] }))).toEqual([])
  })
})

describe('date du prochain test (§ 9, P6.6)', () => {
  function plan(overrides: Partial<GeneratedPlan> = {}): GeneratedPlan {
    return {
      startDate: TODAY,
      provisional: false,
      phases: [],
      weeks: [
        {
          index: 4,
          startDate: '2026-12-21',
          endDate: '2026-12-27',
          test: true,
          sessions: [{ date: '2026-12-23', code: RunSessionCode.Test }],
        },
      ] as unknown as GeneratedPlan['weeks'],
      ...overrides,
    }
  }

  it('prend la date de la séance de test, pas celle de la semaine', () => {
    expect(nextTestDate(plan(), TODAY)).toBe('2026-12-23')
  })

  it('n’annonce aucune date sur un plan provisoire', () => {
    expect(nextTestDate(plan({ provisional: true }), TODAY)).toBeNull()
  })
})
