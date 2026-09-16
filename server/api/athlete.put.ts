import { z } from 'zod'
import { regeneratePlan } from '../application/regenerate-plan'
import { PlanTrigger } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { athlete } from '../infra/db/schema'
import { planGateway, systemClock } from '../utils/context'

const weekdaySchema = z.number().int().min(1).max(7)

const bodySchema = z.object({
  weightKg: z.number().positive().nullable().default(null),
  maxHr: z.number().int().positive().nullable().default(null),
  constraints: z.object({
    availableDays: z.array(weekdaySchema),
    longRunDay: weekdaySchema.optional(),
    easyDays: z.array(weekdaySchema).optional(),
    notes: z.array(z.string()).optional(),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const [saved] = await useDatabase()
    .insert(athlete)
    .values({ id: 1, ...body, availableDays: body.constraints.availableDays, onboarded: true })
    .onConflictDoUpdate({
      target: athlete.id,
      set: { ...body, availableDays: body.constraints.availableDays, onboarded: true },
    })
    .returning()

  await regeneratePlan(planGateway(), systemClock, PlanTrigger.Onboarding)
  return saved
})
