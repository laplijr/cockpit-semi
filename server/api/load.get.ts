import { and, asc, eq, gte } from 'drizzle-orm'
import { loadRatio, monotony, RATIO_REFERENCE, type DailyLoad } from '../domain/load/load'
import { firstExitFromBand, projectLoads, ratioSeries } from '../domain/load/projection'
import { startOfWeek } from '../domain/plan/calendar'
import { SessionStatus } from '../domain/plan/session'
import { RacePriority, RaceStatus } from '../domain/races/race'
import { prescribedUnits, type Prescription } from '../domain/shared/prescription'
import { Sport } from '../domain/shared/sport'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { loadDaily, race } from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const today = systemClock.today()

  const [rows, active, [raceA]] = await Promise.all([
    db
      .select()
      .from(loadDaily)
      .where(eq(loadDaily.athleteId, athleteId))
      .orderBy(asc(loadDaily.date)),
    loadActivePlanVersion(db, athleteId),
    db
      .select({ date: race.date, name: race.name })
      .from(race)
      .where(
        and(
          eq(race.athleteId, athleteId),
          eq(race.priority, RacePriority.A),
          eq(race.status, RaceStatus.Planned),
          gte(race.date, today),
        ),
      )
      .orderBy(asc(race.date))
      .limit(1),
  ])

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
    projection: projectionOf(loads, active, raceA, today),
  }
})

type ActivePlan = Awaited<ReturnType<typeof loadActivePlanVersion>>

/**
 * La charge prolongée jusqu'au jour J (P22) : du début du plan à la prochaine
 * course A, ou à la fin du plan sans course A. Une lecture, pas une
 * proposition : si la courbe sort de la bande, les règles s'en chargent, ou pas.
 */
function projectionOf(
  loads: DailyLoad[],
  active: ActivePlan,
  raceA: { date: string; name: string } | undefined,
  today: string,
) {
  const first = active?.weeks[0]?.startDate
  const end = raceA?.date ?? active?.weeks.at(-1)?.endDate
  if (!active || !first || !end || end < today) return null

  const planned = active.sessions
    .filter((item) => item.status === SessionStatus.Planned)
    .map((item) => ({
      date: item.date,
      sport: item.sport as Sport,
      units: prescribedUnits(item.prescription as unknown as Prescription),
    }))

  const points = ratioSeries(projectLoads(loads, planned, today), first, end, today)
  const exit = firstExitFromBand(points)

  return {
    raceName: raceA?.name ?? null,
    endDate: end,
    points,
    exit: exit ? { date: exit.date, ratio: exit.ratio!, weekStart: startOfWeek(exit.date) } : null,
  }
}
