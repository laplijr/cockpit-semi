import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { AthleteProfile } from '../../domain/athlete/profile'
import { Sport } from '../../domain/shared/sport'
import { useDatabase } from '../../infra/db/client'
import { athlete } from '../../infra/db/schema'
import { currentAthleteId } from '../../utils/context'

const weekdaySchema = z.number().int().min(1).max(7)

/**
 * Une étape n'écrit que ses champs. `PUT /api/athlete` régénère le plan à
 * chaque appel : l'enchaîner six fois produirait cinq plans jetés (§ 9, P8.2).
 */
const bodySchema = z
  .object({
    firstName: z.string().min(1).max(40).nullable(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    weightKg: z.number().positive().nullable(),
    profile: z.enum(AthleteProfile).nullable(),
    startWeeklyVolumeM: z.number().int().positive(),
    peakWeeklyVolumeM: z.number().int().positive(),
    maxWeeklyIncreasePct: z.number().int().positive(),
    constraints: z.object({
      availableDays: z.array(weekdaySchema),
      longRunDay: weekdaySchema.optional(),
      easyDays: z.array(weekdaySchema).optional(),
      runsPerWeek: z.number().int().min(2).max(6).optional(),
      sports: z.array(z.enum(Sport)).optional(),
      notes: z.array(z.string()).optional(),
    }),
  })
  .partial()

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  /** La colonne dénormalisée suit les contraintes, comme dans `PUT /api/athlete`. */
  const values = {
    ...body,
    ...(body.constraints ? { availableDays: body.constraints.availableDays } : {}),
  }

  const [saved] = await useDatabase()
    .update(athlete)
    .set(values)
    .where(eq(athlete.id, athleteId))
    .returning()

  return saved
})
