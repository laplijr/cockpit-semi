import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  await useDatabase()
    .delete(race)
    .where(and(eq(race.id, id), eq(race.athleteId, athleteId)))
  await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.RaceAdded)
  return { ok: true }
})
