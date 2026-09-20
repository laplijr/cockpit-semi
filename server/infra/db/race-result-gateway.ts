import { eq } from 'drizzle-orm'
import type { RaceResultGateway } from '../../application/record-race-result'
import { RaceStatus } from '../../domain/races/race'
import type { Database } from './client'
import { fitnessPoint, race, raceSegment } from './schema'

export function createRaceResultGateway(db: Database): RaceResultGateway {
  return {
    async saveResult(input) {
      await db
        .update(race)
        .set({
          resultatS: input.resultatS,
          status: RaceStatus.Raced,
          representative: input.representative,
          incident: input.incident,
          /** Une note laissée vide ne remplace pas celle saisie à la création. */
          ...(input.notes === null ? {} : { notes: input.notes }),
        })
        .where(eq(race.id, input.raceId))

      if (input.segments.length === 0) return

      await db
        .insert(raceSegment)
        .values(input.segments.map((segment) => ({ raceId: input.raceId, ...segment })))
    },

    async saveFitnessPoint(point) {
      await db.insert(fitnessPoint).values(point)
    },
  }
}
