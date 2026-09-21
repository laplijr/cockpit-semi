import { asc, eq } from 'drizzle-orm'
import { loadRatio, monotony, RATIO_REFERENCE, type DailyLoad } from '../domain/load/load'
import { Sport } from '../domain/shared/sport'
import { useDatabase } from '../infra/db/client'
import { loadDaily } from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const rows = await useDatabase()
    .select()
    .from(loadDaily)
    .where(eq(loadDaily.athleteId, athleteId))
    .orderBy(asc(loadDaily.date))
  const today = systemClock.today()

  const loads: DailyLoad[] = rows.map((row) => ({
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
    loads.length === 0
      ? 0
      : Math.round((Date.parse(today) - Date.parse(loads[0]!.date)) / 86_400_000) + 1

  const week = loads.filter(
    (day) => day.date > new Date(Date.parse(today) - 7 * 86_400_000).toISOString().slice(0, 10),
  )
  const bySport = week.reduce(
    (totals, day) => {
      for (const sport of Object.values(Sport)) totals[sport] += day.bySport[sport]
      return totals
    },
    { [Sport.Running]: 0, [Sport.Cycling]: 0, [Sport.Strength]: 0, [Sport.Other]: 0 },
  )

  return {
    today,
    historyDays,
    reference: RATIO_REFERENCE,
    ratio: loadRatio(loads, today, historyDays) ?? null,
    monotony: monotony(loads, today) ?? null,
    weekBySport: bySport,
    weekTotal: Object.values(bySport).reduce((total, value) => total + value, 0),
  }
})
