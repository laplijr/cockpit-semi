import { and, eq } from 'drizzle-orm'
import type { RaceResultGateway } from '../../application/record-race-result'
import { RaceStatus } from '../../domain/races/race'
import type { Database } from './client'
import { fitnessPoint, race, raceSegment } from './schema'

export function createRaceResultGateway(db: Database, athleteId: number): RaceResultGateway {
  return {
    async saveResult(input) {
      const updated = await db
        .update(race)
        .set({
          resultatS: input.resultatS,
          status: RaceStatus.Raced,
          representative: input.representative,
          incident: input.incident,
          /** Une note laissée vide ne remplace pas celle saisie à la création. */
          ...(input.notes === null ? {} : { notes: input.notes }),
        })
        .where(and(eq(race.id, input.raceId), eq(race.athleteId, athleteId)))
        .returning({ id: race.id })

      /** Sans course à soi, aucun segment à poser : l'update n'a rien touché. */
      if (updated.length === 0 || input.segments.length === 0) return

      await db
        .insert(raceSegment)
        .values(input.segments.map((segment) => ({ raceId: input.raceId, ...segment })))
    },

    async saveFitnessPoint(point) {
      await db.insert(fitnessPoint).values({ ...point, athleteId })
    },
  }
}
