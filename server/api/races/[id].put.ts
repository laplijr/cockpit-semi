import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { generateFuelPlan } from '../../application/generate-fuel-plan'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { RaceStatus, racePlansChanged } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { assertRecordExists, objectiveColumns, raceBodySchema } from '../../utils/race-body'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'
import { ownedRace } from '../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Modifier une course. La source, le statut, le résultat et la recherche
 * rattachée ne bougent pas : ils ne se saisissent pas ici (§ 9, P5.10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, raceBodySchema.parse)
  const db = useDatabase()

  const existing = await ownedRace(db, athleteId, id)

  if (existing.status !== RaceStatus.Planned) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Une course courue ou annulée ne se modifie plus.',
    })
  }

  await assertRecordExists(db, athleteId, body)

  const [updated] = await db
    .update(race)
    .set({ ...body, ...objectiveColumns(body) })
    .where(and(eq(race.id, id), eq(race.athleteId, athleteId)))
    .returning()

  const regenerated = racePlansChanged(existing, updated!)
  if (regenerated) {
    await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.RaceEdited)
  }

  /** Le plan ravito dépend de la durée projetée et de la météo attendue (§ 5). */
  const fuelInputChanged =
    existing.expectedTempC !== updated!.expectedTempC ||
    existing.distanceM !== updated!.distanceM ||
    existing.date !== updated!.date
  if (existing.fuelPlan && fuelInputChanged) {
    await generateFuelPlan(db, athleteId, id, systemClock.today())
  }

  return { ...updated, regenerated }
})
