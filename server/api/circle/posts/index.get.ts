import { z } from 'zod'
import { PostSource } from '../../../domain/circle/post'
import { postFor } from '../../../infra/db/circle-gateway'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId } from '../../../utils/context'
import { circleMember } from '../../../utils/scope'

const querySchema = z.object({
  source: z.enum(PostSource),
  sourceId: z.coerce.number().int().positive(),
})

/**
 * Cette séance est-elle déjà au cercle ? La seule question que le dialog pose
 * avant d'offrir le geste ; l'appartenance, elle, vient déjà de `/api/athlete`.
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  await circleMember(db, athleteId)

  const { source, sourceId } = await getValidatedQuery(event, querySchema.parse)
  const published = await postFor(db, athleteId, source, sourceId)

  return { postId: published?.id ?? null }
})
