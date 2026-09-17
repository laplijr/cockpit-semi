import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { raceTimeForVdot } from '../domain/fitness/vdot'
import { rpeByCode } from '../domain/learning/calibration'
import { summariseRecovery } from '../domain/load/recovery'
import { summariseWeek } from '../domain/load/week-summary'
import { addDays } from '../domain/plan/calendar'
import { ProposalStatus } from '../domain/rules/proposal-status'
import { SessionStatus } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import {
  feedback,
  fitnessPoint,
  loadDaily,
  proposal,
  race,
  session,
  strengthSet,
} from '../infra/db/schema'
import { systemClock } from '../utils/context'

const HALF_MARATHON_M = 21097.5

/** Fenêtres de lecture de la page Progression, en jours (§ 9, P6). */
export const PERIODS = { bloc: 56, saison: 182, tout: null } as const

export type Period = keyof typeof PERIODS

const querySchema = z.object({
  period: z.enum(['bloc', 'saison', 'tout'] as const).default('tout'),
})

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const today = systemClock.today()

  const { period } = await getValidatedQuery(event, querySchema.parse)
  const window = PERIODS[period]
  /** Début de la fenêtre ; « tout » remonte avant le premier jour de données. */
  const since = window === null ? '1970-01-01' : addDays(today, -window)

  // Les séances passées se lisent sur toutes les versions de plan, pas seulement
  // sur la courante : une régénération ne doit pas effacer le passé. Elles
  // servent deux fois — à l'adhérence et au résumé de chaque semaine (P5.14).
  const [points, races, loads, active, decisions, keySessions, pastSessions, rated, strength] =
    await Promise.all([
      db.select().from(fitnessPoint).orderBy(asc(fitnessPoint.date)),
      db.select().from(race).orderBy(asc(race.date)),
      db.select().from(loadDaily).orderBy(asc(loadDaily.date)),
      loadActivePlanVersion(db),
      db.select().from(proposal),
      db
        .select()
        .from(session)
        .leftJoin(feedback, eq(feedback.sessionId, session.id))
        .where(and(eq(session.key, true), lte(session.date, today), gte(session.date, since)))
        .orderBy(desc(session.date))
        .limit(40),
      db
        .select({
          date: session.date,
          status: session.status,
          sport: session.sport,
          actualDistanceM: session.actualDistanceM,
        })
        .from(session)
        .where(and(lte(session.date, today), gte(session.date, since))),
      db
        .select({
          code: session.code,
          prescription: session.prescription,
          rpe: feedback.rpe,
          sleepHours: feedback.sleepHours,
        })
        .from(session)
        .innerJoin(feedback, eq(feedback.sessionId, session.id))
        .where(and(lte(session.date, today), gte(session.date, since))),
      db
        .select({
          date: session.date,
          exerciseId: strengthSet.exerciseId,
          loadKg: strengthSet.loadKg,
        })
        .from(strengthSet)
        .innerJoin(session, eq(session.id, strengthSet.sessionId))
        .where(and(lte(session.date, today), gte(session.date, since)))
        .orderBy(asc(session.date)),
    ])

  /** Une semaine du plan avec sa charge et son réalisé (§ 9, P5.14). */
  const weeks = (active?.weeks ?? []).map((week) => {
    const inWeek = <T extends { date: string }>(items: T[]) =>
      items.filter((item) => item.date >= week.startDate && item.date <= week.endDate)
    const days = inWeek(loads)

    return {
      index: week.index,
      startDate: week.startDate,
      endDate: week.endDate,
      phaseType: week.phaseType,
      targetRunM: week.targetRunM,
      light: week.light,
      test: week.test,
      comebackRatio: week.comebackRatio,
      loadUa: days.reduce((total, day) => total + day.totalUa, 0),
      summary: summariseWeek(week, days, inWeek(pastSessions)),
    }
  })

  const done = pastSessions.filter(
    (item) => item.status === SessionStatus.Done || item.status === SessionStatus.Modified,
  )

  const decided = decisions.filter((item) => item.status !== ProposalStatus.Proposed)
  const accepted = decided.filter((item) => item.status === ProposalStatus.Accepted)

  /** Une ligne par jour de la période, pour compter les jours sans rien. */
  const daysWithSessions = new Map<string, number>()
  for (const item of pastSessions) {
    if (item.status === SessionStatus.Done || item.status === SessionStatus.Modified) {
      daysWithSessions.set(item.date, (daysWithSessions.get(item.date) ?? 0) + 1)
    }
  }
  const firstDay = pastSessions.map((item) => item.date).sort()[0] ?? today
  const days: { date: string; sessions: number }[] = []
  for (let cursor = firstDay; cursor <= today; cursor = addDays(cursor, 1)) {
    days.push({ date: cursor, sessions: daysWithSessions.get(cursor) ?? 0 })
  }

  /** Charges tenues par exercice, dans l'ordre du temps (§ 9, P6). */
  const byExercise = new Map<string, { date: string; loadKg: number }[]>()
  for (const set of strength) {
    const previous = byExercise.get(set.exerciseId) ?? []
    const last = previous.at(-1)
    /** Une séance = un point : on garde la charge la plus lourde du jour. */
    if (last?.date === set.date) last.loadKg = Math.max(last.loadKg, set.loadKg)
    else byExercise.set(set.exerciseId, [...previous, { date: set.date, loadKg: set.loadKg }])
  }

  return {
    today,
    period,
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
    /** Calibration du ressenti : de combien le RPE vécu s'écarte du prescrit. */
    rpeCalibration: rpeByCode(
      rated.map((row) => ({
        code: row.code,
        expectedRpe: (row.prescription as { expectedRpe?: number }).expectedRpe ?? 0,
        rpe: row.rpe,
      })),
    ),
    recovery: summariseRecovery({
      nights: rated.map((row) => row.sleepHours).filter((hours): hours is number => hours !== null),
      days,
    }),
    strengthLoads: [...byExercise.entries()]
      .map(([exerciseId, series]) => ({ exerciseId, points: series }))
      .filter((series) => series.points.length > 1)
      .sort((a, b) => b.points.length - a.points.length),
  }
})
