import { z } from 'zod'
import { previewEdit } from '../../application/edit-plan-session'
import { EditKind } from '../../domain/plan/manual-edit'
import { useDatabase } from '../../infra/db/client'
import { createPlanEditGateway } from '../../infra/db/plan-edit-gateway'
import { draftSchema, isoDateSchema } from '../../utils/session-draft'
import { systemClock } from '../../utils/context'

const bodySchema = z.object({
  kind: z.enum(EditKind),
  date: isoDateSchema,
  sessionId: z.number().int().positive().optional(),
  draft: draftSchema.optional(),
})

/** Ce que l'édition coûterait. N'écrit rien : c'est l'aperçu sous les champs. */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const outcome = await previewEdit(createPlanEditGateway(useDatabase()), systemClock, body)
  if (!outcome) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  return outcome
})
