import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'
import { loadAcceptedHabits } from '../../application/detect-habits'
import { adjustmentsFrom } from '../../domain/learning/personal-rules'
import { addDays, startOfWeek } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { isPaceHeld } from '../../domain/rules/pace-held'
import type {
  ClosedWeek,
  RuleContext,
  SessionOutcome,
  UpcomingSession,
} from '../../domain/rules/rules'
import type { RunSessionCode, Prescription } from '../../domain/running/session-types'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { loadGainPerBlock, loadResolvedForecasts } from './forecast-repository'
import { athleteWeekIds, loadRealizedRuns } from './plan-gateway'
import { feedback, pause, session, week } from './schema'

/**
 * Ce que les règles de recalcul lisent (§ 5) : les séances jugées, celles à
 * venir, les habitudes acceptées, les prévisions résolues et la dernière
 * semaine close. Sorti de `proposal-repository.ts`, qui décide et applique.
 */

/** Fenêtre de séances passées examinée par les règles. */
const LOOKBACK_DAYS = 10
/** Fenêtre de séances à venir que les règles peuvent ajuster. */
const LOOKAHEAD_DAYS = 10
/** Nombre de séances déjà jugées examinées par les règles. */
const RECENT_SESSIONS = 8

function repeatsOf(prescription: Prescription): number | null {
  const intense = prescription.steps.find((step) => step.intense && step.repeats)
  return intense?.repeats ?? null
}

export async function buildContext(
  db: Database,
  athleteId: number,
  today: string,
): Promise<RuleContext> {
  const mine = athleteWeekIds(db, athleteId)

  // Les séances déjà jugées font foi, même si elles sont datées après aujourd'hui :
  // c'est la dernière séance notée qui ancre la fenêtre, pas la date du jour.
  const rated = await db
    .select()
    .from(session)
    .leftJoin(feedback, eq(feedback.sessionId, session.id))
    .where(
      and(
        inArray(session.status, [
          SessionStatus.Done,
          SessionStatus.Modified,
          SessionStatus.Skipped,
        ]),
        inArray(session.weekId, mine),
      ),
    )
    .orderBy(desc(session.date))
    .limit(RECENT_SESSIONS)

  const anchor = rated[0]?.session.date ?? today
  const horizon = anchor > today ? anchor : today

  const [resolved, gain] = await Promise.all([
    loadResolvedForecasts(db, athleteId),
    loadGainPerBlock(db, athleteId),
  ])

  const [past, future] = await Promise.all([
    Promise.resolve(rated.filter((row) => row.session.date >= addDays(horizon, -LOOKBACK_DAYS))),
    db
      .select()
      .from(session)
      .where(
        and(
          gte(session.date, addDays(horizon, 1)),
          lt(session.date, addDays(horizon, LOOKAHEAD_DAYS)),
          eq(session.status, SessionStatus.Planned),
          inArray(session.weekId, mine),
        ),
      )
      .orderBy(asc(session.date)),
  ])

  const recent: SessionOutcome[] = past.map((row) => ({
    sessionId: row.session.id,
    date: row.session.date,
    sport: row.session.sport,
    code: row.session.code as RunSessionCode,
    key: row.session.key,
    expectedRpe: (row.session.prescription as unknown as Prescription).expectedRpe,
    rpe: row.feedback?.rpe ?? null,
    sensations: row.feedback?.sensations ?? [],
    sleepHours: row.feedback?.sleepHours ?? null,
    pain: row.feedback?.pain ?? null,
    paceHeld: isPaceHeld({
      prescription: row.session.prescription as unknown as Prescription,
      actualDistanceM: row.session.actualDistanceM,
      actualDurationMin: row.session.actualDurationMin,
      rpe: row.feedback?.rpe ?? null,
    }),
    skipped: row.session.status === SessionStatus.Skipped,
  }))

  const upcoming: UpcomingSession[] = future.map((row) => {
    const prescription = row.prescription as unknown as Prescription
    return {
      sessionId: row.id,
      date: row.date,
      sport: row.sport,
      code: row.code as RunSessionCode,
      key: row.key,
      distanceM: prescription.totalDistanceM,
      repeats: repeatsOf(prescription),
      expectedRpe: prescription.expectedRpe,
    }
  })

  return {
    today: horizon,
    recent,
    upcoming,
    sameDayStrength: upcoming.filter((item) => item.sport === Sport.Strength),
    /** Les habitudes acceptées deviennent des règles R100+ (§ 5). */
    personal: adjustmentsFrom(await loadAcceptedHabits(db, athleteId)),
    forecasts: resolved,
    gainPerBlock: gain,
    closedWeek: await loadClosedWeek(db, athleteId, today),
  }
}

/**
 * La dernière semaine close, lue sur la version qui la portait : le plan actif
 * commence souvent au lundi en cours et n'en a aucune (même borne que le bilan
 * du dimanche, P7.1). Une course qui attend son retour, ou faite sans distance
 * relevée, laisse la semaine sans mesure : elle ne se juge pas encore.
 */
async function loadClosedWeek(
  db: Database,
  athleteId: number,
  today: string,
): Promise<ClosedWeek | undefined> {
  const start = addDays(startOfWeek(today), -7)
  const end = addDays(start, 6)
  const mine = athleteWeekIds(db, athleteId)

  const [[planned], runs, realized, pauses] = await Promise.all([
    db
      .select()
      .from(week)
      .where(and(eq(week.startDate, start), inArray(week.id, mine)))
      .orderBy(desc(week.planVersionId))
      .limit(1),
    db
      .select({ status: session.status, distanceM: session.actualDistanceM })
      .from(session)
      .where(
        and(
          inArray(session.weekId, mine),
          eq(session.sport, Sport.Running),
          gte(session.date, start),
          lte(session.date, end),
        ),
      ),
    loadRealizedRuns(db, athleteId, start),
    db
      .select({ id: pause.id })
      .from(pause)
      .where(
        and(
          eq(pause.athleteId, athleteId),
          lte(pause.startDate, end),
          or(isNull(pause.endDate), gte(pause.endDate, start)),
        ),
      )
      .limit(1),
  ])
  if (!planned) return undefined

  const unmeasured = runs.some(
    (run) =>
      run.status === SessionStatus.Planned ||
      run.status === SessionStatus.Modified ||
      (run.status === SessionStatus.Done && run.distanceM === null),
  )
  const runM = realized
    .filter((run) => run.date <= end)
    .reduce((total, run) => total + run.distanceM, 0)

  return {
    weekId: planned.id,
    startDate: start,
    targetRunM: planned.targetRunM,
    runM: unmeasured ? null : Math.round(runM),
    excused: pauses.length > 0 || planned.comebackRatio !== null,
  }
}
