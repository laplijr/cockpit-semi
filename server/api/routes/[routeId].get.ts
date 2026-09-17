import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { route } from '../../infra/db/schema'

const paramsSchema = z.object({ routeId: z.coerce.number().int().positive() })

/** Le GPX tel qu'il entre dans la montre : un fichier, pas du JSON. */
export default defineEventHandler(async (event) => {
  const { routeId } = await getValidatedRouterParams(event, paramsSchema.parse)

  const [row] = await useDatabase().select().from(route).where(eq(route.id, routeId)).limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Itinéraire inconnu' })

  setHeader(event, 'Content-Type', 'application/gpx+xml; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName(row)}"`)
  return row.gpx
})

function fileName(row: { date: string; code: string; rank: number }): string {
  const subject = row.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `cockpit-${row.date}-${subject}-${row.rank + 1}.gpx`
}
