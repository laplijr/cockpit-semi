import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { ForecastTarget, accuracy, accuracyByHorizon } from '../domain/fitness/accuracy'
import { confidenceHistory } from '../domain/fitness/confidence-history'
import { raceTimeForVdot } from '../domain/fitness/vdot'
import { rpeByCode } from '../domain/learning/calibration'
import { summariseRecovery } from '../domain/load/recovery'
import { progressCounters, summariseWeek } from '../domain/load/week-summary'
import { addDays } from '../domain/plan/calendar'
import { ObjectiveMode, RacePriority, RaceStatus } from '../domain/races/race'
import { personalRecords, recordFor } from '../domain/races/records'
import { ProposalStatus } from '../domain/rules/proposal-status'
import { windowStart } from '../domain/shared/period'
import { Sport } from '../domain/shared/sport'
import { strengthExercise } from '../domain/strength/exercises'
import { SessionStatus } from '../domain/plan/session'
import { RunSessionCode } from '../domain/running/session-types'
import { useDatabase } from '../infra/db/client'
import { loadGainPerBlock, loadResolvedForecasts } from '../infra/db/forecast-repository'
import { athleteWeekIds, loadActivePlanVersion } from '../infra/db/plan-gateway'
import {
  feedback,
  fitnessPoint,
  forecast,
  loadDaily,
  pause,
  proposal,
  race,
  session,
  strengthSet,
} from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

const HALF_MARATHON_M = 21097.5

const querySchema = z.object({
  period: z.enum(['bloc', 'saison', 'tout'] as const).default('tout'),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const today = systemClock.today()

  const mine = athleteWeekIds(db, athleteId)

  const { period } = await getValidatedQuery(event, querySchema.parse)
  const since = windowStart(today, period)

  // Les séances passées se lisent sur toutes les versions de plan, pas seulement
  // sur la courante : une régénération ne doit pas effacer le passé. Elles
  // servent deux fois — à l'adhérence et au résumé de chaque semaine (P5.14).
  const [
    points,
    races,
    loads,
    active,
    decisions,
    keySessions,
    pastSessions,
    rated,
    strength,
    pauses,
    resolvedForecasts,
    gainPerBlock,
    forecastRows,
  ] = await Promise.all([
    db
      .select()
      .from(fitnessPoint)
      .where(eq(fitnessPoint.athleteId, athleteId))
      .orderBy(asc(fitnessPoint.date)),
    db.select().from(race).where(eq(race.athleteId, athleteId)).orderBy(asc(race.date)),
    db
      .select()
      .from(loadDaily)
      .where(eq(loadDaily.athleteId, athleteId))
      .orderBy(asc(loadDaily.date)),
    loadActivePlanVersion(db, athleteId),
    db.select().from(proposal).where(eq(proposal.athleteId, athleteId)),
    db
      .select()
      .from(session)
      .leftJoin(feedback, eq(feedback.sessionId, session.id))
      .where(
        and(
          eq(session.key, true),
          lte(session.date, today),
          gte(session.date, since),
          inArray(session.weekId, mine),
        ),
      )
      .orderBy(desc(session.date))
      .limit(40),
    db
      .select({
        date: session.date,
        status: session.status,
        sport: session.sport,
        code: session.code,
        key: session.key,
        actualDistanceM: session.actualDistanceM,
      })
      .from(session)
      .where(
        and(lte(session.date, today), gte(session.date, since), inArray(session.weekId, mine)),
      ),
    db
      .select({
        code: session.code,
        prescription: session.prescription,
        rpe: feedback.rpe,
        sleepHours: feedback.sleepHours,
      })
      .from(session)
      .innerJoin(feedback, eq(feedback.sessionId, session.id))
      .where(
        and(lte(session.date, today), gte(session.date, since), inArray(session.weekId, mine)),
      ),
    db
      .select({
        date: session.date,
        exerciseId: strengthSet.exerciseId,
        loadKg: strengthSet.loadKg,
      })
      .from(strengthSet)
      .innerJoin(session, eq(session.id, strengthSet.sessionId))
      .where(and(lte(session.date, today), gte(session.date, since), inArray(session.weekId, mine)))
      .orderBy(asc(session.date)),
    db.select().from(pause).where(eq(pause.athleteId, athleteId)).orderBy(asc(pause.startDate)),
    loadResolvedForecasts(db, athleteId),
    loadGainPerBlock(db, athleteId),
    db
      .select()
      .from(forecast)
      .leftJoin(race, eq(race.id, forecast.raceId))
      .where(and(eq(forecast.athleteId, athleteId), isNotNull(forecast.actualVdot)))
      .orderBy(desc(forecast.resolvedDate), desc(forecast.id))
      .limit(12),
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
      summary: summariseWeek(
        week,
        days,
        inWeek(pastSessions).map((item) => ({
          ...item,
          longRun: item.sport === Sport.Running && item.code === RunSessionCode.LongRun,
        })),
      ),
    }
  })

  const done = pastSessions.filter(
    (item) => item.status === SessionStatus.Done || item.status === SessionStatus.Modified,
  )

  /** Records personnels : ils alimentent aussi la référence du mode record (§ 5). */
  const records = personalRecords(races)

  /**
   * La course A que la confiance suit : la plus proche qui ait une cible.
   * Une course A dont l'objectif reste à fixer n'a pas de confiance à tracer —
   * on regarde alors la suivante plutôt que de ne rien montrer (§ 5).
   */
  const targetOf = (row: (typeof races)[number]) =>
    row.objectiveMode === ObjectiveMode.Record
      ? (recordFor(records, row.distanceM)?.timeS ?? null)
      : row.objectifS

  const targetRace = races
    .filter((row) => row.priority === RacePriority.A && row.status === RaceStatus.Planned)
    .filter((row) => row.date >= today && targetOf(row) !== null)
    .at(0)

  const confidence = targetRace
    ? confidenceHistory(
        points.filter((point) => point.date >= since),
        {
          date: targetRace.date,
          distanceM: targetRace.distanceM,
          elevationGainM: targetRace.elevationGainM,
          expectedTempC: targetRace.expectedTempC,
          targetS: targetOf(targetRace),
        },
        pauses,
        gainPerBlock,
      )
    : []

  /**
   * Le chemin parcouru se compte depuis la reprise — la fin de la dernière
   * pause fermée — et non depuis le début des temps : c'est ce bloc-là qui est
   * en cours (§ 9, P6.5).
   */
  const resumedOn = pauses.filter((row) => row.endDate !== null).at(-1)?.endDate ?? null
  const openPause = pauses.find((row) => row.endDate === null)

  const counters = progressCounters(
    pastSessions
      .filter((item) => resumedOn === null || item.date >= resumedOn)
      .map((item) => ({ ...item, elevationGainM: null })),
    [...weeks]
      .reverse()
      .filter((week) => week.endDate <= today)
      .map((week) => ({
        summary: week.summary,
        excused: coveredByPause(week.startDate, week.endDate, pauses),
      })),
    RunSessionCode.LongRun,
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
    records,
    confidence,
    /** La course dont la confiance est tracée : le graphe la nomme. */
    confidenceRace: targetRace ? { id: targetRace.id, name: targetRace.name } : null,
    counters,
    /**
     * Ce que le cockpit avait prévu, confronté au réalisé. Une ligne par
     * comparaison résolue, la plus récente en tête, et un verdict par horizon
     * (§ 9, P6.6).
     */
    forecasts: forecastRows.map(({ forecast: row, race: target }) => ({
      id: row.id,
      target: row.target,
      label: row.target === ForecastTarget.Test ? 'Test 20′' : (target?.name ?? 'Course'),
      issuedDate: row.issuedDate,
      targetDate: row.targetDate,
      resolvedDate: row.resolvedDate,
      projectedVdot: row.projectedVdot,
      lowVdot: row.lowVdot,
      highVdot: row.highVdot,
      actualVdot: row.actualVdot,
      gapVdot: row.gapVdot,
    })),
    /** Le verdict d'ensemble, puis le même horizon par horizon (§ 9, P6.6). */
    forecastOverall: accuracy(resolvedForecasts) ?? null,
    forecastAccuracy: accuracyByHorizon(resolvedForecasts),
    /** Progression estimée en vigueur : le dialog du cadran VDOT la cite. */
    gainPerBlock,
    resumedOn,
    pausedNow: openPause !== undefined,
    /**
     * Un exercice au poids du corps n'a pas de charge à suivre : sa courbe
     * serait une droite à zéro. On ne garde que ce qui se charge (§ 9, P6).
     */
    strengthLoads: [...byExercise.entries()]
      .map(([exerciseId, series]) => ({
        exerciseId,
        label: strengthExercise(exerciseId)?.label ?? exerciseId,
        points: series,
      }))
      .filter((series) => series.points.length > 1)
      .filter((series) => series.points.some((point) => point.loadKg > 0))
      .sort((a, b) => b.points.length - a.points.length),
  }
})

/** Vrai quand une pause recouvre la semaine, même en partie : elle l'excuse. */
function coveredByPause(
  startDate: string,
  endDate: string,
  pauses: { startDate: string; endDate: string | null }[],
): boolean {
  return pauses.some(
    (row) => row.startDate <= endDate && (row.endDate ?? '9999-12-31') >= startDate,
  )
}
