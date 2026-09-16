import { z } from 'zod'
import { recordFeedback } from '../../../application/record-feedback'
import { Sensation } from '../../../domain/load/feedback'
import { useDatabase } from '../../../infra/db/client'
import { createFeedbackGateway } from '../../../infra/db/feedback-gateway'
import { systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  rpe: z.number().int().min(1).max(10),
  sensations: z.array(z.enum(Sensation)).default([]),
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  pain: z
    .object({ zone: z.string().min(1), intensity: z.number().int().min(0).max(10) })
    .nullable()
    .default(null),
  durationMin: z.number().positive(),
  distanceM: z.number().positive().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    const result = await recordFeedback(createFeedbackGateway(useDatabase()), systemClock, {
      sessionId: id,
      ...body,
    })
    return { ok: true, load: result.load, proposals: result.proposals.length }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  }
})
