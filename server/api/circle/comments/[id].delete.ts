import { z } from 'zod'
import { deleteComment } from '../../../infra/db/circle-gateway'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId } from '../../../utils/context'
import { removableComment } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Chacun retire ses mots, et l'auteur d'un post ceux qu'il a reçus. */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const target = await removableComment(db, athleteId, id)
  await deleteComment(db, target.id)

  return { ok: true }
})
