import { z } from 'zod'
import { checkpointRun } from '../../../application/record-run'
import { currentAthleteId, runGateway } from '../../../utils/context'
import { fixesSchema } from '../../../utils/run-fixes'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const bodySchema = z.object({ fixes: fixesSchema })

/**
 * Point de reprise au fil de la sortie. La trace vit d'abord dans l'appareil ;
 * ce dépôt régulier est ce qui la sauve d'une batterie à plat (§ 9, P10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { fixes } = await readValidatedBody(event, bodySchema.parse)

  try {
    const track = await checkpointRun(runGateway(athleteId), id, fixes)
    return { distanceM: track.distanceM, elapsedS: track.elapsedS, points: track.points.length }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Sortie inconnue ou déjà close' })
  }
})
