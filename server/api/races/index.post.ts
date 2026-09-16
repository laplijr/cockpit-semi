import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { ObjectiveMode, RacePriority } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

const bodySchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.number().positive(),
  priority: z.nativeEnum(RacePriority),
  objectiveMode: z.nativeEnum(ObjectiveMode).default(ObjectiveMode.Time),
  objectifS: z.number().int().positive().nullable().default(null),
  elevationGainM: z.number().int().nullable().default(null),
  expectedTempC: z.number().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const [created] = await useDatabase()
    .insert(race)
    .values({
      ...body,
      objectifS: body.objectiveMode === ObjectiveMode.MaxPerformance ? null : body.objectifS,
    })
    .returning()

  await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceAdded)
  return created
})
