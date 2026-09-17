import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseGpx } from '../../../domain/routes/gpx'
import { useDatabase } from '../../../infra/db/client'
import { raceRoute } from '../../../infra/db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Itinéraires enregistrés d'une course. Le GPX lui-même ne remonte pas — il se
 * télécharge — mais ses points remontent, pour que la fenêtre dessine la trace.
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const rows = await useDatabase()
    .select()
    .from(raceRoute)
    .where(eq(raceRoute.raceId, id))
    .orderBy(asc(raceRoute.date), asc(raceRoute.sessionId), asc(raceRoute.rank))

  return rows.map(({ gpx, ...row }) => ({ ...row, points: parseGpx(gpx) }))
})
