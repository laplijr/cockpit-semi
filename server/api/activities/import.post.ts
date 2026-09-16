import { and, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { matchActivity, sportFromStrava } from '../../domain/matching/match-activity'
import { addDays } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { Sport } from '../../domain/shared/sport'
import { useDatabase } from '../../infra/db/client'
import { recomputeLoadFor } from '../../infra/db/load-repository'
import { activity, athlete, session } from '../../infra/db/schema'

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

export default defineEventHandler(async (event) => {
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
