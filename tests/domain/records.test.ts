import { describe, expect, it } from 'vitest'
import {
  RecordDistance,
  personalRecords,
  recordDistanceOf,
  recordFor,
  type RacedResult,
} from '~~/server/domain/races/records'

const race = (over: Partial<RacedResult> & { id: number }): RacedResult => ({
  name: 'Course',
  date: '2026-09-13',
  distanceM: 21_097.5,
  resultatS: 7560,
  representative: true,
  ...over,
})

describe('records personnels (§ 9, P6.5)', () => {
  it('range une course sur sa distance de référence, à 5 % près', () => {
    expect(recordDistanceOf(21_500)).toBe(RecordDistance.Half)
    expect(recordDistanceOf(5000)).toBe(RecordDistance.FiveK)
    expect(recordDistanceOf(25_000)).toBeUndefined()
  })

  it('garde la meilleure des deux courses sur la même distance', () => {
    const records = personalRecords([
      race({ id: 1, name: 'Vannes', resultatS: 7560 }),
      race({ id: 2, name: 'Auray', date: '2027-09-12', resultatS: 7200 }),
    ])

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ raceId: 2, name: 'Auray', timeS: 7200 })
  })

  it('écarte un chrono non représentatif : il ne reflète pas la forme', () => {
    expect(personalRecords([race({ id: 1, representative: false })])).toEqual([])
    expect(personalRecords([race({ id: 1, resultatS: null })])).toEqual([])
  })

  it('ne rend aucune ligne pour une distance sans résultat, et ne replie sur rien', () => {
    const records = personalRecords([race({ id: 1 })])

    expect(records.map((item) => item.distance)).toEqual([RecordDistance.Half])
    expect(recordFor(records, 10_000)).toBeUndefined()
  })

  it('ramène un 21,5 km au semi pour que deux courses se comparent', () => {
    const [record] = personalRecords([race({ id: 1, distanceM: 21_500, resultatS: 8760 })])

    /** 2:26:00 sur 21,5 km valent 2:23:16 sur 21,0975 km. */
    expect(record!.timeS).toBe(8596)
  })

  it('donne les équivalences Daniels sur les distances voisines, au même VDOT', () => {
    const [record] = personalRecords([race({ id: 1, resultatS: 7560 })])
    const tenK = record!.equivalents.find((item) => item.distance === RecordDistance.TenK)

    expect(record!.equivalents.map((item) => item.distance)).not.toContain(RecordDistance.Half)
    expect(tenK!.timeS).toBeLessThan(record!.timeS)
    expect(tenK!.timeS).toBeGreaterThan(record!.timeS / 2.5)
  })

  it('sert de référence au mode record, sur la distance visée', () => {
    const records = personalRecords([race({ id: 1, resultatS: 7560 })])

    expect(recordFor(records, 21_097.5)?.timeS).toBe(7560)
  })
})
