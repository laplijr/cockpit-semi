import { z } from 'zod'
import { MAX_COMMENT_LENGTH, commentRefusal } from '../../../../domain/circle/post'
import { insertComment } from '../../../../infra/db/circle-gateway'
import { useDatabase } from '../../../../infra/db/client'
import { currentAthleteId } from '../../../../utils/context'
import { visiblePost } from '../../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const bodySchema = z.object({ text: z.string().max(MAX_COMMENT_LENGTH) })

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { text } = await readValidatedBody(event, bodySchema.parse)

  const refusal = commentRefusal(text)
  if (refusal) throw createError({ statusCode: 422, statusMessage: refusal })

  const target = await visiblePost(db, athleteId, id)
  return { id: await insertComment(db, athleteId, target.id, text.trim()) }
})
