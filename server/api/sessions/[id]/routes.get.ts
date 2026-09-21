import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseGpx } from '../../../domain/routes/gpx'
import { rejectionsOf } from '../../../domain/routes/validate'
import { useDatabase } from '../../../infra/db/client'
import { route } from '../../../infra/db/schema'
import { currentAthleteId, routeGateway } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * Itinéraires déjà proposés pour une séance, et l'adresse à pré-remplir. Le
 * GPX lui-même ne remonte pas — il se télécharge — mais ses points remontent,
 * pour que le dialog dessine la trace.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const gateway = routeGateway(athleteId)

  /** Sans séance à soi, pas d'itinéraire : la porte se ferme avant la lecture. */
  if (!(await gateway.loadTarget(id))) {
    throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  }

  const [rows, homeAddress] = await Promise.all([
    useDatabase().select().from(route).where(eq(route.sessionId, id)).orderBy(asc(route.rank)),
    gateway.loadHomeAddress(),
  ])

  return {
    homeAddress,
    routes: rows.map(({ gpx, ...row }) => {
      const points = parseGpx(gpx)
      return {
        ...row,
        points,
        /** Ce qui sépare la trace de la cible, pour que l'écran le dise (§ 9). */
        rejections: rejectionsOf(
          {
            points,
            distanceM: row.distanceM,
            elevationGainM: row.elevationGainM,
            turns: row.turns,
          },
          {
            sessionId: row.sessionId,
            date: row.date,
            code: row.code,
            distanceM: row.targetDistanceM,
          },
        ),
      }
    }),
  }
})
