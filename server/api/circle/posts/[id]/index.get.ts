import { z } from 'zod'
import { commentsOf, identitiesOf, postById } from '../../../../infra/db/circle-gateway'
import { useDatabase } from '../../../../infra/db/client'
import { currentAthleteId } from '../../../../utils/context'
import { visiblePost } from '../../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Le détail d'une publication : le post, ses bravos nommés, ses commentaires. */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const target = await visiblePost(db, athleteId, id)
  const detail = await postById(db, athleteId, target.id)
  const comments = await commentsOf(db, athleteId, target.id, target.athleteId)
  const authors = await identitiesOf(db, [...new Set(comments.map((one) => one.athleteId))])

  return {
    me: athleteId,
    post: detail,
    author: (await identitiesOf(db, [target.athleteId]))[0] ?? null,
    comments,
    authors,
  }
})
