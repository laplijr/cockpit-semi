import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { toGpx } from '../../../domain/routes/gpx'
import { measureTrack } from '../../../domain/tracking/track'
import { useDatabase } from '../../../infra/db/client'
import { run } from '../../../infra/db/schema'
import { currentAthleteId } from '../../../utils/context'
import { ownedSession } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** La trace relevée, telle qu'elle se garde ou se rejoue ailleurs (§ 9, P12). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDatabase()

  const current = await ownedSession(db, athleteId, id)

  const [row] = await db
    .select()
    .from(run)
    .where(and(eq(run.athleteId, athleteId), eq(run.sessionId, id)))
    .orderBy(desc(run.startedAt))
    .limit(1)

  const points = row ? measureTrack(row.fixes).points : []
  if (points.length === 0) throw createError({ statusCode: 404, statusMessage: 'Aucune trace' })

  setHeader(event, 'Content-Type', 'application/gpx+xml; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="cockpit-${current.date}.gpx"`)
  return toGpx(`${current.code} · ${current.date}`, points)
})
