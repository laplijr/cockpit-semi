import { z } from 'zod'
import { useDatabase } from '../../../infra/db/client'
import { acceptProposal } from '../../../infra/db/proposal-repository'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const applied = await acceptProposal(useDatabase(), id)
  if (!applied) throw createError({ statusCode: 404, statusMessage: 'Proposition inconnue' })
  return { ok: true, ruleId: applied.ruleId, effect: applied.effect }
})
