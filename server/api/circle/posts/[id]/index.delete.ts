import { z } from 'zod'
import { deletePost } from '../../../../infra/db/circle-gateway'
import { useDatabase } from '../../../../infra/db/client'
import { currentAthleteId } from '../../../../utils/context'
import { ownedPost } from '../../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Retirer sa publication : elle part avec ses bravos et ses commentaires. */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const target = await ownedPost(db, athleteId, id)
  await deletePost(db, target.id)

  return { ok: true }
})
