import { describe, expect, it } from 'vitest'
import { vdotFromRace } from '~~/server/domain/fitness/vdot'
import { RaceStatus, SegmentMode } from '~~/server/domain/races/race'
import {
  canRecordResult,
  fitnessFromResult,
  resultRefusal,
  type ResultSegment,
} from '~~/server/domain/races/result'

const PARIS = { date: '2027-03-07', status: RaceStatus.Planned, distanceM: 21097.5 }
const CHRONO_S = 2 * 3600 + 3 * 60

function segment(partial: Partial<ResultSegment>): ResultSegment {
  return {
    kmDebut: 0,
    kmFin: 14,
    mode: SegmentMode.Running,
    allureSKm: 330,
    note: null,
    ...partial,
  }
}

describe('quand un résultat de course se saisit (§ 5, P6.41)', () => {
  it('refuse la veille de la course', () => {
    expect(canRecordResult(PARIS, '2027-03-06')).toBe(false)
    expect(resultRefusal(PARIS, '2027-03-06', CHRONO_S)).toMatch(/jour de la course/)
  })

  it('accepte le jour de la course et les jours suivants', () => {
    expect(canRecordResult(PARIS, '2027-03-07')).toBe(true)
    expect(canRecordResult(PARIS, '2027-03-20')).toBe(true)
    expect(resultRefusal(PARIS, '2027-03-07', CHRONO_S)).toBeUndefined()
  })

  it('refuse une course déjà courue ou annulée', () => {
    const raced = { ...PARIS, status: RaceStatus.Raced }
    const cancelled = { ...PARIS, status: RaceStatus.Cancelled }

    expect(canRecordResult(raced, '2027-03-07')).toBe(false)
    expect(resultRefusal(raced, '2027-03-07', CHRONO_S)).toMatch(/déjà un résultat/)
    expect(resultRefusal(cancelled, '2027-03-07', CHRONO_S)).toMatch(/annulée/)
  })

  /** Un semi en 40′ ou en dix heures est une unité ratée, pas une performance. */
  it('refuse un chrono incompatible avec la distance', () => {
    expect(resultRefusal(PARIS, '2027-03-07', 40 * 60)).toMatch(/ne correspond pas/)
    expect(resultRefusal(PARIS, '2027-03-07', 10 * 3600)).toMatch(/ne correspond pas/)
  })
})

describe('ce qu’un résultat apprend sur la forme (§ 5, P6.41)', () => {
  it('mesure le VDOT quand le chrono est représentatif', () => {
    const fitness = fitnessFromResult({
      distanceM: 21097.5,
      resultatS: CHRONO_S,
      representative: true,
      segments: [],
    })

    expect(fitness).toEqual({ vdot: vdotFromRace(21097.5, CHRONO_S), isFloor: false })
  })

  it('tire un plancher du meilleur segment continu quand il ne l’est pas', () => {
    const fitness = fitnessFromResult({
      distanceM: 21500,
      resultatS: 2 * 3600 + 26 * 60,
      representative: false,
      segments: [segment({}), segment({ kmDebut: 14, kmFin: 21.5, allureSKm: 480 })],
    })

    expect(fitness?.isFloor).toBe(true)
    expect(fitness?.vdot).toBeCloseTo(vdotFromRace(14_000, 14 * 330), 6)
  })

  it('n’apprend rien d’une course non représentative sans segment assez long', () => {
    const short = segment({ kmFin: 8 })
    expect(
      fitnessFromResult({
        distanceM: 21500,
        resultatS: 2 * 3600,
        representative: false,
        segments: [short],
      }),
    ).toBeUndefined()
  })

  /** Une portion marchée ne dit rien de la forme : elle ne fait pas plancher. */
  it('ignore les segments marchés', () => {
    const walked = segment({ mode: SegmentMode.Walking, allureSKm: 600 })
    expect(
      fitnessFromResult({
        distanceM: 21500,
        resultatS: 2 * 3600,
        representative: false,
        segments: [walked],
      }),
    ).toBeUndefined()
  })
})
