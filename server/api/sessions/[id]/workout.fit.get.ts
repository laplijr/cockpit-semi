import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Prescription } from '../../../domain/shared/prescription'
import { structuredWorkout } from '../../../domain/watch/workout'
import { useDatabase } from '../../../infra/db/client'
import { session } from '../../../infra/db/schema'
import { encodeWorkout } from '../../../infra/watch/fit-encoder'
import { systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/**
 * La séance telle qu'elle entre dans la montre : un `.FIT` de type workout, à
 * déposer dans `GARMIN/NEWFILES/` (§ 9, P6.7). Une séance qui ne se court pas
 * — vélo, renforcement — n'en a pas.
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const [row] = await useDatabase().select().from(session).where(eq(session.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  const workout = structuredWorkout(row.prescription as unknown as Prescription)
  if (!workout) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cette séance ne se transmet pas à une montre.',
    })
  }

  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName(row)}"`)

  return encodeWorkout(workout, new Date(`${systemClock.today()}T00:00:00Z`))
})

function fileName(row: { date: string; code: string }): string {
  const subject = row.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `cockpit-${row.date}-${subject}.fit`
}
