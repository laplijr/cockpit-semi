import { z } from 'zod'
import { cancelSession } from '../../../application/edit-plan-session'
import { useDatabase } from '../../../infra/db/client'
import { createPlanEditGateway } from '../../../infra/db/plan-edit-gateway'
import { systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Retire une séance à venir sans la compter comme manquée (§ 5, P6.43). */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const outcome = await cancelSession(createPlanEditGateway(useDatabase()), systemClock, id)
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  if (!outcome.ok) throw createError({ statusCode: 409, statusMessage: outcome.refusal })

  return outcome
})
