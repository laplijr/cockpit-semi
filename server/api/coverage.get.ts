import { asc, count } from 'drizzle-orm'
import { MIN_HISTORY_DAYS } from '../domain/load/load'
import { READINESS_SESSIONS } from '../domain/readiness/readiness'
import { useDatabase } from '../infra/db/client'
import { feedback, fitnessPoint, loadDaily } from '../infra/db/schema'
import { systemClock } from '../utils/context'

/**
 * Ce que les instruments attendent encore pour s'allumer. La tuile des
 * premiers jours remplace les cadrans sans données et dit quand ils
 * s'allumeront ; elle disparaît quand il ne manque plus rien (§ 9, P8.2).
 */
export default defineEventHandler(async () => {
  const db = useDatabase()
  const [days, feedbacks, points] = await Promise.all([
    db.select({ date: loadDaily.date }).from(loadDaily).orderBy(asc(loadDaily.date)).limit(1),
    db.select({ total: count() }).from(feedback),
    db.select({ total: count() }).from(fitnessPoint),
  ])

  const first = days[0]?.date
  const historyDays = first
    ? Math.round((Date.parse(systemClock.today()) - Date.parse(first)) / 86_400_000) + 1
    : 0

  return {
    loadDaysMissing: Math.max(0, MIN_HISTORY_DAYS - historyDays),
    feedbacksMissing: Math.max(0, READINESS_SESSIONS - (feedbacks[0]?.total ?? 0)),
    fitnessPoints: points[0]?.total ?? 0,
  }
})
