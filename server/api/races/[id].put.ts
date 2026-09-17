import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { RaceStatus, racePlansChanged } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { assertRecordExists, objectiveColumns, raceBodySchema } from '../../utils/race-body'
import { planGateway, systemClock } from '../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Modifier une course. La source, le statut, le résultat et la recherche
 * rattachée ne bougent pas : ils ne se saisissent pas ici (§ 9, P5.10).
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, raceBodySchema.parse)
  const db = useDatabase()

  const [existing] = await db.select().from(race).where(eq(race.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Course inconnue' })

  if (existing.status !== RaceStatus.Planned) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Une course courue ou annulée ne se modifie plus.',
    })
  }

  await assertRecordExists(db, body)

  const [updated] = await db
    .update(race)
    .set({ ...body, ...objectiveColumns(body) })
    .where(eq(race.id, id))
    .returning()

  const regenerated = racePlansChanged(existing, updated!)
  if (regenerated) {
    await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceEdited)
  }

  return { ...updated, regenerated }
})
