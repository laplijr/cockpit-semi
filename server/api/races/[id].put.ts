import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { ObjectiveMode, RacePriority, RaceStatus, racePlansChanged } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.number().positive(),
  priority: z.enum(RacePriority),
  objectiveMode: z.enum(ObjectiveMode),
  objectifS: z.number().int().positive().nullable().default(null),
  elevationGainM: z.number().int().nullable().default(null),
  expectedTempC: z.number().nullable().default(null),
  notes: z.string().nullable().default(null),
})

/**
 * Modifier une course. La source, le statut, le résultat et la recherche
 * rattachée ne bougent pas : ils ne se saisissent pas ici (§ 9, P5.10).
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const [existing] = await db.select().from(race).where(eq(race.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Course inconnue' })

  if (existing.status !== RaceStatus.Planned) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Une course courue ou annulée ne se modifie plus.',
    })
  }

  const [updated] = await db
    .update(race)
    .set({
      ...body,
      objectifS: body.objectiveMode === ObjectiveMode.MaxPerformance ? null : body.objectifS,
    })
    .where(eq(race.id, id))
    .returning()

  const regenerated = racePlansChanged(existing, updated!)
  if (regenerated) {
    await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceEdited)
  }

  return { ...updated, regenerated }
})
