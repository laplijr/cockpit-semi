import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseGpx } from '../../../domain/routes/gpx'
import { useDatabase } from '../../../infra/db/client'
import { route } from '../../../infra/db/schema'
import { routeGateway } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Itinéraires déjà proposés pour une séance, et l'adresse à pré-remplir. Le
 * GPX lui-même ne remonte pas — il se télécharge — mais ses points remontent,
 * pour que le dialog dessine la trace.
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const [rows, homeAddress] = await Promise.all([
    useDatabase().select().from(route).where(eq(route.sessionId, id)).orderBy(asc(route.rank)),
    routeGateway().loadHomeAddress(),
  ])

  return {
    homeAddress,
    routes: rows.map(({ gpx, ...row }) => ({ ...row, points: parseGpx(gpx) })),
  }
})
