import { z } from 'zod'
import { recordStrengthSet } from '../../../../application/record-strength-sets'
import { useDatabase } from '../../../../infra/db/client'
import { createStrengthGateway } from '../../../../infra/db/strength-gateway'
import { currentAthleteId } from '../../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  exerciseId: z.string().min(1),
  index: z.number().int().positive(),
  reps: z.number().int().min(0),
  loadKg: z.number().min(0),
  /** La réserve de la série, stockée en RPE : 10 − réserve (P27). */
  rpe: z.number().int().min(1).max(10),
})

/** Une série cochée en salle, écrite tout de suite (P27). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const set = await readValidatedBody(event, bodySchema.parse)

  await recordStrengthSet(createStrengthGateway(useDatabase(), athleteId), id, set)
  return { ok: true }
})
