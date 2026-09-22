import { z } from 'zod'
import { recordFeedback } from '../../../application/record-feedback'
import { Sensation } from '../../../domain/load/feedback'
import { useDatabase } from '../../../infra/db/client'
import { createFeedbackGateway } from '../../../infra/db/feedback-gateway'
import { SessionStatus } from '../../../domain/plan/session'
import { shareDoneSession } from '../../../utils/circle-share'
import { ownedSession } from '../../../utils/scope'
import { currentAthleteId, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  rpe: z.number().int().min(1).max(10),
  sensations: z.array(z.enum(Sensation)).default([]),
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  pain: z
    .object({ zone: z.string().min(1), intensity: z.number().int().min(0).max(10) })
    .nullable()
    .default(null),
  durationMin: z.number().positive(),
  distanceM: z.number().positive().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDatabase()
  /** L'état d'avant décide du cercle : une correction ne republie pas (§ 9, P12). */
  const before = await ownedSession(db, athleteId, id)

  try {
    const result = await recordFeedback(createFeedbackGateway(db, athleteId), systemClock, {
      sessionId: id,
      ...body,
    })

    if (before.status !== SessionStatus.Done) await shareDoneSession(db, athleteId, id)

    return { ok: true, load: result.load, proposals: result.proposals.length }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  }
})
