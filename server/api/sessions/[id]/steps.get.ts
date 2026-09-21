import { z } from 'zod'
import { prescribedDurationS, type Prescription } from '../../../domain/shared/prescription'
import { flattenWorkout } from '../../../domain/tracking/steps'
import { structuredWorkout } from '../../../domain/watch/workout'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId } from '../../../utils/context'
import { ownedSession } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Les étapes de la séance, répétitions dépliées : c'est ce que l'écran de
 * course décompte une à une. La séance structurée est celle de P6.7 — la
 * montre et le téléphone lisent la même (§ 9, P10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const row = await ownedSession(useDatabase(), athleteId, id)
  const prescription = row.prescription as unknown as Prescription
  const workout = structuredWorkout(prescription)

  if (!workout) {
    throw createError({ statusCode: 404, statusMessage: 'Cette séance ne se court pas.' })
  }

  return {
    sessionId: row.id,
    date: row.date,
    code: row.code,
    label: prescription.label,
    key: row.key,
    status: row.status,
    totalDistanceM: prescription.totalDistanceM,
    totalDurationS: Math.round(prescribedDurationS(prescription)),
    targets: flattenWorkout(workout),
  }
})
