import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { currentAthleteId } from '../../utils/context'
import { ownedRoute } from '../../utils/scope'

const paramsSchema = z.object({ routeId: z.coerce.number().int().positive() })

/** Le GPX tel qu'il entre dans la montre : un fichier, pas du JSON. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { routeId } = await getValidatedRouterParams(event, paramsSchema.parse)

  const row = await ownedRoute(useDatabase(), athleteId, routeId)

  setHeader(event, 'Content-Type', 'application/gpx+xml; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName(row)}"`)
  return row.gpx
})

function fileName(row: { date: string; code: string; rank: number }): string {
  const subject = row.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `cockpit-${row.date}-${subject}-${row.rank + 1}.gpx`
}
