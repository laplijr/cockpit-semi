import { z } from 'zod'
import { planRideSwap } from '../../../application/replace-ride-with-run'
import { useDatabase } from '../../../infra/db/client'
import { createSessionSwapGateway } from '../../../infra/db/session-swap-gateway'
import { planGateway, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Ce que deviendrait la sortie vélo du jour, ou la raison pour laquelle elle ne
 * peut pas être remplacée. Lecture seule : rien n'est appliqué ici (§ 9, P6.42).
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const outcome = await planRideSwap(
    createSessionSwapGateway(useDatabase()),
    planGateway(),
    systemClock,
    id,
  )
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  return outcome
})
