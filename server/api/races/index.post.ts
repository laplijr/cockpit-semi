import { and, eq } from 'drizzle-orm'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { RaceSource } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race, raceLookup } from '../../infra/db/schema'
import { assertRecordExists, newRaceBodySchema, objectiveColumns } from '../../utils/race-body'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { lookupId, ...body } = await readValidatedBody(event, newRaceBodySchema.parse)
  const db = useDatabase()

  await assertRecordExists(db, athleteId, body)

  const [created] = await db
    .insert(race)
    .values({
      ...body,
      athleteId,
      source: lookupId === null ? RaceSource.Manual : RaceSource.Search,
      ...objectiveColumns(body),
    })
    .returning()

  if (lookupId !== null) {
    await db
      .update(raceLookup)
      .set({ raceId: created!.id })
      .where(and(eq(raceLookup.id, lookupId), eq(raceLookup.athleteId, athleteId)))
  }

  await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.RaceAdded)
  return created
})
