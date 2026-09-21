import { z } from 'zod'
import { applyRideSwap } from '../../../application/replace-ride-with-run'
import { useDatabase } from '../../../infra/db/client'
import { createSessionSwapGateway } from '../../../infra/db/session-swap-gateway'
import { currentAthleteId, planGateway, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Remplace la sortie vélo du jour par une endurance. La règle du jour même est
 * vérifiée ici, sur l'horloge de l'app : un bouton absent de l'écran n'est pas
 * une garantie (§ 5, § 9 P6.42).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const outcome = await applyRideSwap(
    createSessionSwapGateway(useDatabase(), athleteId),
    planGateway(athleteId),
    systemClock,
    id,
  )
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  if (!outcome.ok) throw createError({ statusCode: 409, statusMessage: outcome.refusal })

  return outcome
})
