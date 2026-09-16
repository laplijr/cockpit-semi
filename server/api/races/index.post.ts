import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { ObjectiveMode, RacePriority, RaceSource } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race, raceLookup } from '../../infra/db/schema'
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
  /** Recherche qui a pré-rempli le formulaire : rattachée à la course créée (§ 6). */
  lookupId: z.number().int().positive().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const { lookupId, ...body } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const [created] = await db
    .insert(race)
    .values({
      ...body,
      source: lookupId === null ? RaceSource.Manual : RaceSource.Search,
      objectifS: body.objectiveMode === ObjectiveMode.MaxPerformance ? null : body.objectifS,
    })
    .returning()

  if (lookupId !== null) {
    await db.update(raceLookup).set({ raceId: created!.id }).where(eq(raceLookup.id, lookupId))
  }

  await regeneratePlan(planGateway(), systemClock, PlanTrigger.RaceAdded)
  return created
})
