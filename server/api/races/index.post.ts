import { eq } from 'drizzle-orm'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { RaceSource } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race, raceLookup } from '../../infra/db/schema'
import { assertRecordExists, newRaceBodySchema, objectiveColumns } from '../../utils/race-body'
import { planGateway, systemClock } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const { lookupId, ...body } = await readValidatedBody(event, newRaceBodySchema.parse)
  const db = useDatabase()

  await assertRecordExists(db, body)

  const [created] = await db
    .insert(race)
    .values({
      ...body,
      source: lookupId === null ? RaceSource.Manual : RaceSource.Search,
      ...objectiveColumns(body),
    })
    .returning()

  if (lookupId !== null) {
    await db.update(raceLookup).set({ raceId: created!.id }).where(eq(raceLookup.id, lookupId))
  }

  await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceAdded)
  return created
})
