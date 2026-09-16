import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  await useDatabase().delete(race).where(eq(race.id, id))
  await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceAdded)
  return { ok: true }
})
