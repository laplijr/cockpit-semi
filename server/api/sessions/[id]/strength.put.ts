import { z } from 'zod'
import { recordStrengthSets } from '../../../application/record-strength-sets'
import { useDatabase } from '../../../infra/db/client'
import { createStrengthGateway } from '../../../infra/db/strength-gateway'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  sets: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        index: z.number().int().positive(),
        reps: z.number().int().min(0),
        loadKg: z.number().min(0),
        rpe: z.number().int().min(1).max(10),
      }),
    )
    .default([]),
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { sets } = await readValidatedBody(event, bodySchema.parse)

  const nextLoads = await recordStrengthSets(createStrengthGateway(useDatabase()), id, sets)
  return { ok: true, nextLoads }
})
