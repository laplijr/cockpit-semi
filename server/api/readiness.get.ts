import { and, desc, eq, gte } from 'drizzle-orm'
import { loadRatio, type DailyLoad } from '../domain/load/load'
import { addDays } from '../domain/plan/calendar'
import { readiness } from '../domain/readiness/readiness'
import { Sport } from '../domain/shared/sport'
import { useDatabase } from '../infra/db/client'
import { feedback, loadDaily, session } from '../infra/db/schema'
import { systemClock } from '../utils/context'

export default defineEventHandler(async () => {
  const db = useDatabase()
  const today = systemClock.today()

  const [recent, loads] = await Promise.all([
    db
      .select()
      .from(session)
      .innerJoin(feedback, eq(feedback.sessionId, session.id))
      .where(and(gte(session.date, addDays(today, -14))))
      .orderBy(desc(session.date))
      .limit(3),
    db.select().from(loadDaily).orderBy(loadDaily.date),
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
})
