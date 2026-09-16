import { eq } from 'drizzle-orm'
import { arbitraryUnits, type LoadEntry } from '../../domain/load/load'
import type { IsoDate } from '../../domain/plan/calendar'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { activity, feedback, loadDaily, session } from './schema'

/** Effort perçu retenu pour une activité sans RPE connu (§ 7, point 4). */
export const DEFAULT_ACTIVITY_RPE = 5

/** Toutes les entrées de charge d'une journée : séances faites et activités importées. */
async function entriesFor(db: Database, date: IsoDate): Promise<LoadEntry[]> {
  const [done, imported] = await Promise.all([
    db
      .select({
        sport: session.sport,
        durationMin: session.actualDurationMin,
        rpe: feedback.rpe,
      })
      .from(session)
      .innerJoin(feedback, eq(feedback.sessionId, session.id))
      .where(eq(session.date, date)),
    db
      .select({
        sport: activity.sport,
        durationS: activity.durationS,
        rpe: activity.rpe,
        sessionId: activity.sessionId,
      })
      .from(activity)
      .where(eq(activity.date, date)),
  ])

  const fromSessions = done
    .filter((row) => row.durationMin !== null)
    .map((row) => ({ date, sport: row.sport, rpe: row.rpe, durationMin: row.durationMin! }))

  // Une activité rattachée est déjà comptée par sa séance : on ne la compte pas deux fois.
  const fromActivities = imported
    .filter((row) => row.sessionId === null)
    .map((row) => ({
      date,
      sport: row.sport,
      rpe: row.rpe ?? DEFAULT_ACTIVITY_RPE,
      durationMin: row.durationS / 60,
    }))

  return [...fromSessions, ...fromActivities]
}

const EMPTY = {
  [Sport.Running]: 0,
  [Sport.Cycling]: 0,
  [Sport.Strength]: 0,
  [Sport.Other]: 0,
}

export async function recomputeLoadFor(db: Database, date: IsoDate) {
  const entries = await entriesFor(db, date)
  const bySport = { ...EMPTY }

  for (const entry of entries) {
    bySport[entry.sport] += arbitraryUnits(entry)
  }

  const row = {
    date,
    runningUa: Math.round(bySport[Sport.Running]),
    cyclingUa: Math.round(bySport[Sport.Cycling]),
    strengthUa: Math.round(bySport[Sport.Strength]),
    otherUa: Math.round(bySport[Sport.Other]),
    totalUa: Math.round(Object.values(bySport).reduce((total, value) => total + value, 0)),
  }

  await db.insert(loadDaily).values(row).onConflictDoUpdate({ target: loadDaily.date, set: row })

  return row
}
