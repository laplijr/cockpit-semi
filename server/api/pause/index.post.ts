import { z } from 'zod'
import { openPause } from '../../application/open-pause'
import { PauseType } from '../../domain/pause/pause'
import { useDatabase } from '../../infra/db/client'
import { createPauseGateway } from '../../infra/db/feedback-gateway'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

const bodySchema = z.object({
  type: z.enum(PauseType),
  zone: z.string().min(1).nullable().default(null),
  painLevel: z.number().int().min(0).max(10).nullable().default(null),
  estimatedEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  allowances: z.object({
    running: z.boolean(),
    cycling: z.boolean(),
    upperBodyStrength: z.boolean(),
    legStrength: z.boolean(),
    conditions: z.array(z.string().min(1)).default([]),
  }),
  watchZones: z.array(z.string().min(1)).default([]),
  notes: z.string().min(1).nullable().default(null),
})

/** Déclarer une pause gèle le plan et le régénère (§ 5). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  return openPause(
    createPauseGateway(useDatabase(), athleteId),
    planGateway(athleteId),
    systemClock,
    body,
  )
})
