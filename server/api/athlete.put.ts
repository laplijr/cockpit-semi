import { z } from 'zod'
import { regeneratePlan } from '../application/regenerate-plan'
import { AthleteProfile, MAX_AVATAR_BYTES } from '../domain/athlete/profile'
import { PlanTrigger } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { athlete } from '../infra/db/schema'
import { planGateway, systemClock } from '../utils/context'

const weekdaySchema = z.number().int().min(1).max(7)

const bodySchema = z.object({
  firstName: z.string().min(1).max(40).nullable().default(null),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  profile: z.enum(AthleteProfile).nullable().default(null),
  /** Data URL d'au plus 100 Ko : au-delà, l'écran refuse avant d'envoyer. */
  avatar: z.string().max(MAX_AVATAR_BYTES).nullable().default(null),
  weightKg: z.number().positive().nullable().default(null),
  homeAddress: z.string().max(200).nullable().default(null),
  maxHr: z.number().int().positive().nullable().default(null),
  startWeeklyVolumeM: z.number().int().positive().nullable().default(null),
  peakWeeklyVolumeM: z.number().int().positive().nullable().default(null),
  constraints: z.object({
    availableDays: z.array(weekdaySchema),
    longRunDay: weekdaySchema.optional(),
    easyDays: z.array(weekdaySchema).optional(),
    runsPerWeek: z.number().int().min(2).max(6).optional(),
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
