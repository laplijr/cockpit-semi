import { z } from 'zod'
import { abandonRun } from '../../../application/record-run'
import { currentAthleteId, runGateway } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Sortie abandonnée : elle se ferme sans rien écrire dans le réalisé (§ 9, P10). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  try {
    await abandonRun(runGateway(athleteId), id)
    return { ok: true }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Sortie inconnue ou déjà close' })
  }
})
