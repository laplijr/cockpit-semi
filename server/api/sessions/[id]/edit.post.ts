import { z } from 'zod'
import { replaceSession } from '../../../application/edit-plan-session'
import { useDatabase } from '../../../infra/db/client'
import { createPlanEditGateway } from '../../../infra/db/plan-edit-gateway'
import { draftSchema } from '../../../utils/session-draft'
import { currentAthleteId, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Remplace une séance par celle que Ronan décrit (§ 9, P6.43). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const draft = await readValidatedBody(event, draftSchema.parse)

  const outcome = await replaceSession(
    createPlanEditGateway(useDatabase(), athleteId),
    systemClock,
    id,
    draft,
  )
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  if (!outcome.ok) throw createError({ statusCode: 409, statusMessage: outcome.refusal })

  return outcome
})
