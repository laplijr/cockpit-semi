import { z } from 'zod'
import { recordMissed } from '../../../application/record-feedback'
import { SessionStatus } from '../../../domain/plan/session'
import { useDatabase } from '../../../infra/db/client'
import { createFeedbackGateway } from '../../../infra/db/feedback-gateway'
import { ownedSession } from '../../../utils/scope'
import { currentAthleteId, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Marque manquée une séance prévue dont le jour est arrivé (§ 5, R6). Une
 * séance à venir se retire du plan, elle ne se manque pas d'avance.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const db = useDatabase()
  const row = await ownedSession(db, athleteId, id)
  if (row.status !== SessionStatus.Planned) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Seule une séance prévue se marque manquée.',
    })
  }
  if (row.date > systemClock.today()) {
    throw createError({ statusCode: 409, statusMessage: 'Une séance à venir se retire du plan.' })
  }

  const proposals = await recordMissed(createFeedbackGateway(db, athleteId), systemClock, id)
  return { ok: true, proposals: proposals.length }
})
