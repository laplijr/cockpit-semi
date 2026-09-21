import { z } from 'zod'
import { generateFuelPlan } from '../../../application/generate-fuel-plan'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Régénère le plan ravito à la demande, sans attendre le cron de J−7. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const plan = await generateFuelPlan(useDatabase(), athleteId, id, systemClock.today())
  if (!plan) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Aucune projection : le plan ravito demande un point de forme.',
    })
  }

  return plan
})
