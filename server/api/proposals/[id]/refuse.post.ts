import { z } from 'zod'
import { useDatabase } from '../../../infra/db/client'
import { refuseProposal } from '../../../infra/db/proposal-repository'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Un refus est archivé, pas supprimé : c'est un signal d'apprentissage (§ 1.3). */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  await refuseProposal(useDatabase(), id)
  return { ok: true }
})
