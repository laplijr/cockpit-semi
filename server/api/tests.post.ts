import { z } from 'zod'
import { TEST_DURATION_S, recordTest } from '../application/record-test'
import { useDatabase } from '../infra/db/client'
import { createFitnessGateway } from '../infra/db/feedback-gateway'
import { currentAthleteId, planGateway, systemClock } from '../utils/context'

const bodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  distanceM: z.number().positive(),
  durationS: z.number().int().positive().default(TEST_DURATION_S),
})

/** Enregistre un test de terrain : il devient le VDOT courant et régénère le plan. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  return recordTest(
    createFitnessGateway(useDatabase(), athleteId),
    planGateway(athleteId),
    systemClock,
    body,
  )
})
