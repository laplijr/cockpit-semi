import { z } from 'zod'
import { finishRun } from '../../../application/record-run'
import { Sensation } from '../../../domain/load/feedback'
import { useDatabase } from '../../../infra/db/client'
import { shareDoneSession } from '../../../utils/circle-share'
import { currentAthleteId, runGateways, systemClock } from '../../../utils/context'
import { fixesSchema } from '../../../utils/run-fixes'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  fixes: fixesSchema.default([]),
  rpe: z.number().int().min(1).max(10),
  sensations: z.array(z.enum(Sensation)).default([]),
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  pain: z
    .object({ zone: z.string().min(1), intensity: z.number().int().min(0).max(10) })
    .nullable()
    .default(null),
  notes: z.string().nullable().default(null),
  correctedDistanceM: z.number().positive().nullable().default(null),
  correctedDurationMin: z.number().positive().nullable().default(null),
})

/**
 * Fin de sortie : la trace devient une activité et la séance passe à « faite »
 * avec son ressenti. Aucun chemin d'écriture nouveau (§ 9, P10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    const outcome = await finishRun(runGateways(athleteId), systemClock, { runId: id, ...body })

    /** La séance vient de passer « faite » : elle va au cercle (§ 9, P12). */
    if (outcome.sessionId !== null) {
      await shareDoneSession(useDatabase(), athleteId, outcome.sessionId)
    }

    return outcome
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Enregistrement impossible'
    throw createError({ statusCode: 422, statusMessage: message })
  }
})
