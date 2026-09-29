import { z } from 'zod'
import { correctActivityRpe } from '../../../application/correct-activity-rpe'
import { useDatabase } from '../../../infra/db/client'
import { createActivityRpeGateway } from '../../../infra/db/off-plan-gateway'
import { currentAthleteId } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({ rpe: z.number().int().min(1).max(10) })

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { rpe } = await readValidatedBody(event, bodySchema.parse)

  try {
    const load = await correctActivityRpe(
      createActivityRpeGateway(useDatabase(), athleteId),
      id,
      rpe,
    )
    return { ok: true, load }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Activité hors plan inconnue' })
  }
})
