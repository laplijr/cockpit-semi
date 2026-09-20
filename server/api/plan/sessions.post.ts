import { z } from 'zod'
import { addSession } from '../../application/edit-plan-session'
import { useDatabase } from '../../infra/db/client'
import { createPlanEditGateway } from '../../infra/db/plan-edit-gateway'
import { draftSchema, isoDateSchema } from '../../utils/session-draft'
import { systemClock } from '../../utils/context'

const bodySchema = z.object({ date: isoDateSchema, draft: draftSchema })

/** Ajoute une séance que le générateur n'a pas produite (§ 9, P6.43). */
export default defineEventHandler(async (event) => {
  const { date, draft } = await readValidatedBody(event, bodySchema.parse)

  const outcome = await addSession(createPlanEditGateway(useDatabase()), systemClock, date, draft)
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Journée inconnue' })
  if (!outcome.ok) throw createError({ statusCode: 409, statusMessage: outcome.refusal })

  return outcome
})
