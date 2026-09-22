import { z } from 'zod'
import { PostSource } from '../../../domain/circle/post'
import { circleMembers, postFor } from '../../../infra/db/circle-gateway'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId } from '../../../utils/context'
import { circleMember } from '../../../utils/scope'

const querySchema = z.object({
  source: z.enum(PostSource),
  sourceId: z.coerce.number().int().positive(),
})

/**
 * Cette séance est-elle au cercle, et pour combien de personnes ? La fenêtre
 * n'y pose plus de geste depuis P12 : elle dit un état. L'appartenance, elle,
 * vient déjà de `/api/athlete`.
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  await circleMember(db, athleteId)

  const { source, sourceId } = await getValidatedQuery(event, querySchema.parse)
  const published = await postFor(db, athleteId, source, sourceId)
  const members = await circleMembers(db)

  /** Les autres : on ne se compte pas parmi ceux qui nous lisent. */
  return {
    postId: published?.id ?? null,
    viewers: members.filter((one) => one.id !== athleteId).length,
  }
})
