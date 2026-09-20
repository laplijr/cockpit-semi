import { and, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { importActivities } from '../../application/import-activities'
import { matchActivity, sportFromStrava } from '../../domain/matching/match-activity'
import { addDays } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { Sport } from '../../domain/shared/sport'
import { useDatabase } from '../../infra/db/client'
import { createActivityImportGateway } from '../../infra/db/activity-repository'
import { createFeedbackGateway } from '../../infra/db/feedback-gateway'
import { recomputeLoadFor } from '../../infra/db/load-repository'
import { activity, athlete, session } from '../../infra/db/schema'
import { decodeActivity } from '../../infra/watch/fit-activity'
import { systemClock } from '../../utils/context'

const activitySchema = z.object({
  externalId: z.string().min(1),
  name: z.string().nullable().default(null),
  /** Type Strava brut (« Run », « TrailRun », « Ride »…) ou sport du cockpit. */
  type: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.string().datetime({ offset: true }).optional(),
  durationS: z.number().int().positive(),
  distanceM: z.number().nonnegative().nullable().default(null),
  averageHr: z.number().int().positive().nullable().default(null),
  maxHr: z.number().int().positive().nullable().default(null),
  averageWatts: z.number().nonnegative().nullable().default(null),
  elevationGainM: z.number().nonnegative().nullable().default(null),
})

const bodySchema = z.object({ activities: z.array(activitySchema).min(1).max(2000) })

/** Au plus un dossier `GARMIN/ACTIVITY/` entier : au-delà, c'est une erreur de geste. */
const MAX_FILES = 200

/**
 * Deux entrées, un seul chemin d'import. En multipart, ce sont des fichiers
 * `.FIT` déposés depuis une montre (§ 9, P6.7) ; en JSON, des activités déjà
 * décodées ailleurs. Le rattachement et la charge sont les mêmes.
 */
export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') ?? ''
  if (contentType.includes('multipart/form-data')) return importFitFiles(event)

  const { activities } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const [profile] = await db.select().from(athlete).limit(1)

  const dates = activities.map((item) => item.date).sort()
  const candidates = await db
    .select()
    .from(session)
    .where(
      and(gte(session.date, addDays(dates[0]!, -1)), lte(session.date, addDays(dates.at(-1)!, 1))),
    )

  const matched = new Set<number>()
  let imported = 0
  let linked = 0

  for (const item of activities) {
    const sport = Object.values(Sport).includes(item.type as Sport)
      ? (item.type as Sport)
      : sportFromStrava(item.type)

    const result = matchActivity(
      {
        externalId: item.externalId,
        sport,
        date: item.date,
        durationS: item.durationS,
        averageHr: item.averageHr,
      },
      candidates.map((row) => ({
        id: row.id,
        date: row.date,
        sport: row.sport,
        alreadyMatched: matched.has(row.id) || row.status === SessionStatus.Done,
      })),
      profile?.maxHr ?? null,
    )

    const sessionId = result.kind === 'session' ? result.sessionId : null
    if (sessionId !== null) matched.add(sessionId)

    const values = {
      externalId: item.externalId,
      name: item.name,
      sport,
      date: item.date,
      startedAt: new Date(item.startedAt ?? `${item.date}T12:00:00Z`),
      durationS: item.durationS,
      distanceM: item.distanceM,
      averagePaceSKm:
        item.distanceM && item.distanceM > 0 ? (item.durationS / item.distanceM) * 1000 : null,
      averageHr: item.averageHr,
      maxHr: item.maxHr,
      averageWatts: item.averageWatts,
      elevationGainM: item.elevationGainM,
      sessionId,
    }

    await db
      .insert(activity)
      .values(values)
      .onConflictDoUpdate({ target: activity.externalId, set: values })

    imported += 1
    if (sessionId !== null) linked += 1
  }

  const touched = [...new Set(activities.map((item) => item.date))]
  for (const date of touched) await recomputeLoadFor(db, date)

  return { imported, linked, days: touched.length }
})

/** Les fichiers déposés, décodés puis passés au cas d'usage d'import. */
async function importFitFiles(event: Parameters<typeof getHeader>[0]) {
  const parts = (await readMultipartFormData(event)) ?? []
  const files = parts.filter((part) => part.filename !== undefined)

  if (files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun fichier déposé.' })
  }
  if (files.length > MAX_FILES) {
    throw createError({
      statusCode: 413,
      statusMessage: `Au plus ${MAX_FILES} fichiers à la fois.`,
    })
  }

  const db = useDatabase()
  return importActivities(
    createActivityImportGateway(db),
    createFeedbackGateway(db),
    systemClock,
    files.map((part) => ({
      name: part.filename!,
      activity: decodeActivity(new Uint8Array(part.data)),
    })),
  )
}
