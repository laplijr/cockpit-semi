import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { loadRatio, type DailyLoad } from '../domain/load/load'
import { addDays, type IsoDate } from '../domain/plan/calendar'
import { READINESS_SESSIONS, readiness, type Readiness } from '../domain/readiness/readiness'
import { Sport } from '../domain/shared/sport'
import type { Database } from '../infra/db/client'
import { athleteWeekIds } from '../infra/db/plan-gateway'
import { feedback, loadDaily, session } from '../infra/db/schema'

const RECENT_DAYS = 14

/**
 * La forme du jour telle que le § 5 la définit. Le cadran la lit, la
 * proposition de repas aussi : un seul calcul, une seule lecture de la base.
 */
export async function currentReadiness(
  db: Database,
  athleteId: number,
  today: IsoDate,
): Promise<Readiness> {
  const [recent, loads] = await Promise.all([
    db
      .select()
      .from(session)
      .innerJoin(feedback, eq(feedback.sessionId, session.id))
      .where(
        and(
          gte(session.date, addDays(today, -RECENT_DAYS)),
          inArray(session.weekId, athleteWeekIds(db, athleteId)),
        ),
      )
      .orderBy(desc(session.date))
      .limit(READINESS_SESSIONS),
    db.select().from(loadDaily).where(eq(loadDaily.athleteId, athleteId)).orderBy(loadDaily.date),
  ])

  const daily: DailyLoad[] = loads.map((row) => ({
    date: row.date,
    bySport: {
      [Sport.Running]: row.runningUa,
      [Sport.Cycling]: row.cyclingUa,
      [Sport.Strength]: row.strengthUa,
      [Sport.Other]: row.otherUa,
    },
    total: row.totalUa,
  }))

  const historyDays =
    daily.length === 0
      ? 0
      : Math.round((Date.parse(today) - Date.parse(daily[0]!.date)) / 86_400_000) + 1

  const latest = recent[0]

  return readiness({
    sleepHours: latest?.feedback.sleepHours ?? null,
    rpeDeltas: recent.map(
      (row) =>
        row.feedback.rpe -
        ((row.session.prescription as { expectedRpe?: number }).expectedRpe ?? row.feedback.rpe),
    ),
    sensations: latest?.feedback.sensations ?? [],
    loadRatio: loadRatio(daily, today, historyDays)?.ratio ?? null,
  })
}
