import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { measureTrack } from '../../../domain/tracking/track'
import { useDatabase } from '../../../infra/db/client'
import { run } from '../../../infra/db/schema'
import { currentAthleteId } from '../../../utils/context'
import { ownedSession } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * La trace relevée d'une séance courue depuis le cockpit (§ 9, P10.1, P12).
 * Nulle pour une séance importée ou saisie à la main : la fenêtre n'a alors
 * rien à montrer, et elle ne propose pas une boucle à la place.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDatabase()

  await ownedSession(db, athleteId, id)

  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.athleteId, athleteId), eq(run.sessionId, id)))
    .orderBy(desc(run.startedAt))
    .limit(1)

  if (!row || row.fixes.length === 0) return { track: null }

  /** Les relevés filtrés, ceux-là mêmes qui ont fait la distance (P10.1). */
  const measured = measureTrack(row.fixes)
  const points = measured.points
  if (points.length === 0) return { track: null }
  return {
    track: {
      runId: row.id,
      points: points.map((point) => ({ lat: point.lat, lon: point.lon })),
      distanceM: row.distanceM ?? measured.distanceM,
      durationS: row.durationS ?? Math.round(measured.elapsedS),
    },
  }
})
