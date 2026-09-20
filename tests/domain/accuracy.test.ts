import { describe, expect, it } from 'vitest'
import {
  ForecastHorizon,
  MIN_RESOLVED_FORECASTS,
  accuracy,
  accuracyByHorizon,
  adjustedGainPerBlock,
  horizonOf,
  type ResolvedForecast,
} from '~~/server/domain/fitness/accuracy'
import {
  MAX_INTERVAL_VDOT,
  MIN_INTERVAL_VDOT,
  VDOT_GAIN_PER_BLOCK,
  intervalVdot,
  projectVdot,
} from '~~/server/domain/fitness/projection'

function forecast(gap: number, overrides: Partial<ResolvedForecast> = {}): ResolvedForecast {
  const projectedVdot = overrides.projectedVdot ?? 34
  return {
    issuedDate: '2026-10-01',
    targetDate: '2026-11-01',
    projectedVdot,
    lowVdot: projectedVdot - 0.5,
    highVdot: projectedVdot + 0.5,
    actualVdot: projectedVdot + gap,
    ...overrides,
  }
}

describe('horizon d’une prévision (§ 9, P6.6)', () => {
  it('sépare le court, le moyen et le long terme', () => {
    expect(horizonOf('2026-10-01', '2026-10-20')).toBe(ForecastHorizon.Short)
    expect(horizonOf('2026-10-01', '2026-11-20')).toBe(ForecastHorizon.Medium)
    expect(horizonOf('2026-10-01', '2027-03-01')).toBe(ForecastHorizon.Long)
  })
})

describe('justesse des prévisions (§ 9, P6.6)', () => {
  it('ne rend aucun verdict sous trois comparaisons résolues', () => {
    const few = Array.from({ length: MIN_RESOLVED_FORECASTS - 1 }, () => forecast(0.4))
    expect(accuracy(few)).toBeUndefined()
  })

  it('annule le biais quand les écarts se compensent', () => {
    const verdict = accuracy([forecast(0.6), forecast(-0.6), forecast(0.2), forecast(-0.2)])

    expect(verdict?.biasVdot).toBeCloseTo(0, 6)
    expect(verdict?.absoluteErrorVdot).toBeCloseTo(0.4, 6)
  })

  it('garde le signe quand le moteur se trompe toujours dans le même sens', () => {
    const verdict = accuracy([forecast(0.4), forecast(0.6), forecast(0.8)])
    expect(verdict?.biasVdot).toBeCloseTo(0.6, 6)
  })

  it('compte la couverture sur les seules lignes résolues qu’on lui donne', () => {
    /** Deux dans l'intervalle de ± 0,5, deux en dehors. */
    const verdict = accuracy([forecast(0.2), forecast(-0.3), forecast(0.9), forecast(-1.2)])
    expect(verdict?.coveragePct).toBe(50)
  })

  it('juge chaque horizon séparément', () => {
    const short = Array.from({ length: 3 }, () =>
      forecast(0.8, { issuedDate: '2026-10-01', targetDate: '2026-10-15' }),
    )
    const long = Array.from({ length: 3 }, () =>
      forecast(-0.2, { issuedDate: '2026-10-01', targetDate: '2027-06-01' }),
    )

    const verdicts = accuracyByHorizon([...short, ...long])
    const of = (horizon: ForecastHorizon) =>
      verdicts.find((item) => item.horizon === horizon)?.accuracy

    expect(of(ForecastHorizon.Short)?.biasVdot).toBeCloseTo(0.8, 6)
    expect(of(ForecastHorizon.Medium)).toBeUndefined()
    expect(of(ForecastHorizon.Long)?.biasVdot).toBeCloseTo(-0.2, 6)
  })
})

describe('progression estimée corrigée (§ 5, R9)', () => {
  it('monte quand la forme a dépassé les annonces', () => {
    const verdict = accuracy([forecast(0.6), forecast(0.6), forecast(0.6)])!
    expect(adjustedGainPerBlock(VDOT_GAIN_PER_BLOCK, verdict)).toBeGreaterThan(VDOT_GAIN_PER_BLOCK)
  })

  it('ne descend jamais sous zéro', () => {
    const verdict = accuracy([forecast(-9), forecast(-9), forecast(-9)])!
    expect(adjustedGainPerBlock(VDOT_GAIN_PER_BLOCK, verdict)).toBe(0)
  })

  it('laisse la valeur en place quand les prévisions visaient le jour même', () => {
    const sameDay = Array.from({ length: 3 }, () =>
      forecast(0.6, { issuedDate: '2026-10-01', targetDate: '2026-10-01' }),
    )
    const verdict = accuracy(sameDay)!
    expect(adjustedGainPerBlock(VDOT_GAIN_PER_BLOCK, verdict)).toBe(VDOT_GAIN_PER_BLOCK)
  })
})

describe('intervalle en VDOT (§ 5)', () => {
  it('prend la borne haute pour un plancher et la basse pour une mesure', () => {
    expect(intervalVdot([], true)).toBe(MAX_INTERVAL_VDOT)
    expect(intervalVdot([33], false)).toBe(MIN_INTERVAL_VDOT)
  })

  it('vaut deux écarts-types des écarts entre tests, une fois borné', () => {
    expect(intervalVdot([33, 33.6, 34.2], false)).toBe(MIN_INTERVAL_VDOT)
    expect(intervalVdot([33, 35, 34, 37], false)).toBeGreaterThan(MIN_INTERVAL_VDOT)
  })

  it('encadre la forme attendue sans regarder le dénivelé ni la chaleur', () => {
    const forecast = projectVdot({
      vdot: 34,
      isFloor: false,
      testHistory: [33.6, 34],
      weeksAhead: 8,
    })

    expect(forecast.vdot).toBeCloseTo(34 + VDOT_GAIN_PER_BLOCK, 6)
    expect(forecast.highVdot - forecast.lowVdot).toBeCloseTo(2 * MIN_INTERVAL_VDOT, 6)
  })

  it('ne fait pas progresser les semaines qu’une pause couvre', () => {
    const paused = projectVdot({
      vdot: 34,
      isFloor: false,
      testHistory: [33.6, 34],
      weeksAhead: 8,
      pausedWeeks: 8,
    })

    expect(paused.vdot).toBeCloseTo(34, 6)
  })
})
