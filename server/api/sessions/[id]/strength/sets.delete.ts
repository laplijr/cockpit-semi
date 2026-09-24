import { z } from 'zod'
import { removeStrengthSet } from '../../../../application/record-strength-sets'
import { useDatabase } from '../../../../infra/db/client'
import { createStrengthGateway } from '../../../../infra/db/strength-gateway'
import { currentAthleteId } from '../../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const querySchema = z.object({
  exerciseId: z.string().min(1),
  index: z.coerce.number().int().positive(),
})

/** Une série décochée en salle : elle sort de la séance (P27). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { exerciseId, index } = await getValidatedQuery(event, querySchema.parse)

  await removeStrengthSet(createStrengthGateway(useDatabase(), athleteId), id, exerciseId, index)
  return { ok: true }
})
