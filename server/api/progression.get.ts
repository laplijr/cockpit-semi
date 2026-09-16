import { and, asc, desc, eq, lte } from 'drizzle-orm'
import { raceTimeForVdot } from '../domain/fitness/vdot'
import { ProposalStatus } from '../domain/rules/proposal-status'
import { SessionStatus } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { feedback, fitnessPoint, loadDaily, proposal, race, session } from '../infra/db/schema'
import { systemClock } from '../utils/context'

const HALF_MARATHON_M = 21097.5

export default defineEventHandler(async () => {
  const db = useDatabase()
  const today = systemClock.today()

  const [points, races, loads, active, decisions, keySessions] = await Promise.all([
    db.select().from(fitnessPoint).orderBy(asc(fitnessPoint.date)),
    db.select().from(race).orderBy(asc(race.date)),
    db.select().from(loadDaily).orderBy(asc(loadDaily.date)),
    loadActivePlanVersion(db),
    db.select().from(proposal),
    db
      .select()
      .from(session)
      .leftJoin(feedback, eq(feedback.sessionId, session.id))
      .where(and(eq(session.key, true), lte(session.date, today)))
      .orderBy(desc(session.date))
      .limit(40),
  ])

  /** Une semaine du plan avec sa charge réellement enregistrée. */
  const weeks = (active?.weeks ?? []).map((week) => {
    const days = loads.filter((day) => day.date >= week.startDate && day.date <= week.endDate)
    return {
      index: week.index,
      startDate: week.startDate,
      phaseType: week.phaseType,
      targetRunM: week.targetRunM,
      light: week.light,
      loadUa: days.reduce((total, day) => total + day.totalUa, 0),
    }
  })

  // L'adhérence se lit sur toutes les séances passées, pas seulement sur celles
  // de la version courante : une régénération ne doit pas effacer le passé.
  const pastSessions = await db
    .select({ status: session.status })
    .from(session)
    .where(lte(session.date, today))
  const done = pastSessions.filter(
    (item) => item.status === SessionStatus.Done || item.status === SessionStatus.Modified,
  )

  const decided = decisions.filter((item) => item.status !== ProposalStatus.Proposed)
  const accepted = decided.filter((item) => item.status === ProposalStatus.Accepted)

  return {
    today,
    vdot: points.map((point) => ({
      date: point.date,
      vdot: point.vdot,
      origin: point.origin,
      isFloor: point.isFloor,
      halfProjectionS: Math.round(raceTimeForVdot(point.vdot, HALF_MARATHON_M)),
    })),
    races: races.map((item) => ({
      id: item.id,
      name: item.name,
      date: item.date,
      status: item.status,
      resultatS: item.resultatS,
      representative: item.representative,
    })),
    weeks,
    /** Part des séances prévues effectivement réalisées. */
    adherence:
      pastSessions.length === 0 ? null : Math.round((done.length / pastSessions.length) * 100),
    /** Part des propositions acceptées parmi celles décidées. */
    acceptanceRate:
      decided.length === 0 ? null : Math.round((accepted.length / decided.length) * 100),
    keySessions: keySessions.map((row) => ({
      id: row.session.id,
      date: row.session.date,
      code: row.session.code,
      status: row.session.status,
      expectedRpe: (row.session.prescription as { expectedRpe?: number }).expectedRpe ?? null,
      rpe: row.feedback?.rpe ?? null,
      distanceM: (row.session.prescription as { totalDistanceM?: number }).totalDistanceM ?? null,
    })),
  }
})
