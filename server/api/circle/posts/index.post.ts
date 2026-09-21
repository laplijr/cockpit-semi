import { z } from 'zod'
import {
  PostSource,
  publishRace,
  publishSession,
  type PublishableSession,
} from '../../../domain/circle/post'
import { prescribedDurationS, type Prescription } from '../../../domain/shared/prescription'
import { insertPost, postFor } from '../../../infra/db/circle-gateway'
import { useDatabase } from '../../../infra/db/client'
import { currentAthleteId } from '../../../utils/context'
import { circleMember, ownedRace, ownedSession } from '../../../utils/scope'

const bodySchema = z.object({
  source: z.enum(PostSource),
  sourceId: z.number().int().positive(),
  note: z.string().nullable().default(null),
})

/**
 * Publier au cercle. Le post se construit par la liste blanche de
 * `domain/circle` et jamais depuis la ligne en base : c'est la seule porte
 * par laquelle une donnée d'entraînement traverse le mur (§ 1 principe 6).
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  await circleMember(db, athleteId)

  const { source, sourceId, note } = await readValidatedBody(event, bodySchema.parse)

  const already = await postFor(db, athleteId, source, sourceId)
  if (already) throw createError({ statusCode: 409, statusMessage: 'Déjà publié au cercle.' })

  const outcome =
    source === PostSource.Session
      ? publishSession(fromSession(await ownedSession(db, athleteId, sourceId)), note)
      : publishRace(await ownedRace(db, athleteId, sourceId), note)

  if (!outcome.ok) throw createError({ statusCode: 409, statusMessage: outcome.refusal })

  return { id: await insertPost(db, athleteId, outcome.post), ok: true }
})

/** Ce que la séance donne au domaine : son réalisé, et son prévu en repli. */
function fromSession(row: Awaited<ReturnType<typeof ownedSession>>): PublishableSession {
  const prescription = row.prescription as unknown as Prescription
  const plannedMin = Math.round(prescribedDurationS(prescription) / 60)

  return {
    id: row.id,
    sport: row.sport,
    code: row.code,
    date: row.date,
    status: row.status,
    actualDistanceM: row.actualDistanceM,
    actualDurationMin: row.actualDurationMin,
    plannedDistanceM: prescription.totalDistanceM || null,
    plannedDurationMin: plannedMin || prescription.durationMin || null,
  }
}
