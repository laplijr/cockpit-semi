import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { summariseWeek } from '../domain/load/week-summary'
import { weeklyReview, type ReviewSession } from '../domain/load/weekly-review'
import { addDays, startOfWeek } from '../domain/plan/calendar'
import type { SessionStatus } from '../domain/plan/session'
import { RunSessionCode } from '../domain/running/session-types'
import { Sport } from '../domain/shared/sport'
import { useDatabase } from '../infra/db/client'
import { athleteWeekIds, loadActivePlanVersion } from '../infra/db/plan-gateway'
import { feedback, fitnessPoint, loadDaily, pause, session, week } from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

/**
 * Le bilan de la dernière semaine close (§ 9, P7.1). Il ne porte jamais sur
 * une semaine en cours : elle compterait des jours qui n'ont pas eu lieu et
 * se lirait comme un retard.
 *
 * La semaine se borne au calendrier et non au plan actif : celui-ci commence
 * au lundi de la semaine courante, il n'a donc aucune semaine close. Ce qui
 * était visé se relit sur la version de plan qui portait cette semaine-là.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const today = systemClock.today()

  /**
   * « Le bilan du dimanche » porte sur la semaine qui finit ce dimanche-là :
   * le jour où elle se referme, pas le lendemain. Les autres jours, c'est la
   * semaine précédente, la dernière à être close.
   */
  const thisSunday = addDays(startOfWeek(today), 6)
  const end = thisSunday <= today ? thisSunday : addDays(startOfWeek(today), -1)
  const start = addDays(end, -6)
  const mine = athleteWeekIds(db, athleteId)

  const [planned, days, sessions, feedbacks, points, pauses, active] = await Promise.all([
    /** La dernière version à avoir porté cette semaine : c'est elle qui visait. */
    db
      .select()
      .from(week)
      .where(and(eq(week.startDate, start), inArray(week.id, mine)))
      .orderBy(desc(week.planVersionId))
      .limit(1),
    db
      .select()
      .from(loadDaily)
      .where(
        and(
          eq(loadDaily.athleteId, athleteId),
          gte(loadDaily.date, start),
          lte(loadDaily.date, end),
        ),
      ),
    db
      .select({
        id: session.id,
        sport: session.sport,
        code: session.code,
        status: session.status,
        key: session.key,
        actualDistanceM: session.actualDistanceM,
      })
      .from(session)
      .where(and(gte(session.date, start), lte(session.date, end), inArray(session.weekId, mine))),
    db
      .select({ sleepHours: feedback.sleepHours, pain: feedback.pain })
      .from(feedback)
      .innerJoin(session, eq(feedback.sessionId, session.id))
      .where(and(gte(session.date, start), lte(session.date, end), inArray(session.weekId, mine))),
    db
      .select({ date: fitnessPoint.date, vdot: fitnessPoint.vdot })
      .from(fitnessPoint)
      .where(and(eq(fitnessPoint.athleteId, athleteId), lte(fitnessPoint.date, end)))
      .orderBy(asc(fitnessPoint.date)),
    db
      .select({ startDate: pause.startDate, endDate: pause.endDate })
      .from(pause)
      .where(eq(pause.athleteId, athleteId)),
    loadActivePlanVersion(db, athleteId),
  ])

  const target = planned[0]
  if (!target) return { review: null }

  const summary = summariseWeek(
    {
      targetRunM: target.targetRunM,
      light: target.light,
      test: target.test,
      comebackRatio: target.comebackRatio,
    },
    days,
    sessions.map((item) => ({
      sport: item.sport,
      status: item.status,
      actualDistanceM: item.actualDistanceM,
      key: item.key,
      longRun: toReviewSession(item).longRun,
    })),
  )
  if (!summary) return { review: null }

  /** Celle qui suit la semaine résumée, et non celle du jour : le dimanche, c'est la même. */
  const next = active?.weeks.find((item) => item.startDate === addDays(end, 1))

  const review = weeklyReview({
    weekStart: start,
    weekEnd: end,
    summary,
    sessions: sessions.map(toReviewSession),
    feedbacks: feedbacks.map((item) => ({
      sleepH: item.sleepHours,
      pain: item.pain !== null,
    })),
    excused: coveredByPause(start, end, pauses),
    vdotBefore: vdotAt(points, addDays(start, -1)),
    vdotAfter: vdotAt(points, end),
    nextTargetRunM: next?.targetRunM ?? null,
    nextPhase: next?.phaseType ?? null,
  })

  return { review }
})

function toReviewSession(item: {
  sport: string
  code: string
  status: SessionStatus
  key: boolean
}): ReviewSession {
  return {
    sport: item.sport,
    code: item.code,
    status: item.status,
    key: item.key,
    longRun: item.sport === Sport.Running && item.code === RunSessionCode.LongRun,
  }
}

/**
 * Même excuse qu'à Progression : une semaine couverte par une pause ne se
 * juge pas. Le moteur doit pouvoir dire de lever le pied sans que ça coûte
 * quelque chose (§ 1).
 */
function coveredByPause(
  start: string,
  end: string,
  pauses: { startDate: string; endDate: string | null }[],
): boolean {
  return pauses.some((row) => row.startDate <= end && (row.endDate ?? '9999-12-31') >= start)
}

function vdotAt(points: { date: string; vdot: number }[], on: string): number | null {
  const found = points.filter((item) => item.date <= on)
  return found.at(-1)?.vdot ?? null
}
