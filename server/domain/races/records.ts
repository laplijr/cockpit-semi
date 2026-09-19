import { raceTimeForVdot, vdotFromRace } from '../fitness/vdot'

/**
 * Les distances qu'un coureur de fond reconnaît. Une course de 21,5 km se
 * range sur le semi, pas dans une ligne à elle : un record se lit par distance
 * de référence, sinon chaque course est son propre record (§ 9, P6.5).
 */
export enum RecordDistance {
  FiveK = '5 km',
  TenK = '10 km',
  Half = 'semi',
  Marathon = 'marathon',
}

export const RECORD_DISTANCES_M: Record<RecordDistance, number> = {
  [RecordDistance.FiveK]: 5000,
  [RecordDistance.TenK]: 10_000,
  [RecordDistance.Half]: 21_097.5,
  [RecordDistance.Marathon]: 42_195,
}

/** Tolérance de rattachement : 21,5 km compte pour un semi, 25 km non. */
export const RECORD_TOLERANCE = 0.05

export interface RacedResult {
  id: number
  name: string
  date: string
  distanceM: number
  resultatS: number | null
  /** Faux quand le chrono ne reflète pas la forme : il ne fait pas record (§ 5). */
  representative: boolean
}

export interface RaceRecord {
  distance: RecordDistance
  distanceM: number
  raceId: number
  name: string
  date: string
  timeS: number
  vdot: number
  /** Équivalences Daniels sur les autres distances de référence, au même VDOT. */
  equivalents: { distance: RecordDistance; timeS: number }[]
}

/** La distance de référence d'une course, ou rien si elle n'en approche aucune. */
export function recordDistanceOf(distanceM: number): RecordDistance | undefined {
  return Object.values(RecordDistance).find((distance) => {
    const reference = RECORD_DISTANCES_M[distance]
    return Math.abs(distanceM - reference) / reference <= RECORD_TOLERANCE
  })
}

/**
 * Meilleure performance représentative par distance, dans l'ordre des
 * distances. Une distance sans résultat n'a pas de ligne : un record absent ne
 * se remplace pas par une estimation, sans quoi le mode record de P5.15
 * proposerait de battre un chrono jamais couru (§ 5).
 */
export function personalRecords(races: RacedResult[]): RaceRecord[] {
  const best = new Map<RecordDistance, { race: RacedResult; timeS: number }>()

  for (const race of races) {
    if (!race.representative || race.resultatS === null) continue

    const distance = recordDistanceOf(race.distanceM)
    if (!distance) continue

    /** Le chrono se ramène à la distance de référence pour que 21,5 km et 21,1 km se comparent. */
    const timeS = Math.round(race.resultatS * (RECORD_DISTANCES_M[distance] / race.distanceM))
    const current = best.get(distance)
    if (!current || timeS < current.timeS) best.set(distance, { race, timeS })
  }

  return Object.values(RecordDistance)
    .filter((distance) => best.has(distance))
    .map((distance) => {
      const { race, timeS } = best.get(distance)!
      const distanceM = RECORD_DISTANCES_M[distance]
      const vdot = vdotFromRace(distanceM, timeS)

      return {
        distance,
        distanceM,
        raceId: race.id,
        name: race.name,
        date: race.date,
        timeS,
        vdot,
        equivalents: Object.values(RecordDistance)
          .filter((other) => other !== distance)
          .map((other) => ({
            distance: other,
            timeS: Math.round(raceTimeForVdot(vdot, RECORD_DISTANCES_M[other])),
          })),
      }
    })
}

/** Référence à battre sur une distance donnée ; nulle sans record (§ 5, mode record). */
export function recordFor(records: RaceRecord[], distanceM: number): RaceRecord | undefined {
  const distance = recordDistanceOf(distanceM)
  return distance ? records.find((record) => record.distance === distance) : undefined
}
