import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { ForecastTarget, accuracy, accuracyByHorizon } from '../domain/fitness/accuracy'
import { fitnessCause } from '../domain/fitness/cause'
import { confidenceHistory } from '../domain/fitness/confidence-history'
import { currentFitnessOf } from '../domain/fitness/current'
import { raceTimeForVdot } from '../domain/fitness/vdot'
import { rpeByCode } from '../domain/learning/calibration'
import { weeklyIntensity } from '../domain/load/intensity'
import { coveredByPause, sessionDays, strengthSeries } from '../domain/load/progression-series'
import { summariseRecovery } from '../domain/load/recovery'
import { progressCounters, summariseWeek } from '../domain/load/week-summary'
import { ObjectiveMode, RacePriority, RaceStatus } from '../domain/races/race'
import { personalRecords, recordFor } from '../domain/races/records'
import { ProposalStatus } from '../domain/rules/proposal-status'
import { windowStart } from '../domain/shared/period'
import { Sport } from '../domain/shared/sport'
import { SessionStatus } from '../domain/plan/session'
import type { Prescription } from '../domain/shared/prescription'
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
        actualDurationMin: session.actualDurationMin,
        prescription: session.prescription,
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

  const causeOf = (point: (typeof points)[number], index: number) =>
    fitnessCause(point, points[index - 1], {
      race: races.find((item) => item.id === point.raceId),
    })

  /** Le VDOT de la date, celui dont les zones classaient les allures ce jour-là. */
  const vdotOn = (date: string) =>
    currentFitnessOf(
      points.filter((point) => point.date <= date),
      date,
    )?.vdot ??
    (active?.version.parameters as { vdot?: number } | undefined)?.vdot ??
    null

  /**
   * La répartition de l'intensité d'une semaine, sur ses courses faites (P22).
   * Le réalisé n'a pas de tours : c'est le prescrit, recalé sur la durée.
   */
  const intensityOf = (sessions: typeof pastSessions) => {
    const runs = sessions
      .filter((item) => item.sport === Sport.Running)
      .filter((item) => item.status === SessionStatus.Done)
      .flatMap((item) => {
        const vdot = vdotOn(item.date)
        if (vdot === null) return []
        return [
          {
            prescription: item.prescription as unknown as Prescription,
            vdot,
            actualDurationS: item.actualDurationMin === null ? null : item.actualDurationMin * 60,
          },
        ]
      })
    return weeklyIntensity(runs)
  }

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
      intensity: intensityOf(inWeek(pastSessions)),
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

  /** Faite, et rien d'autre : une séance `modifiee` reste à faire (P28). */
  const done = pastSessions.filter((item) => item.status === SessionStatus.Done)
  const counted = pastSessions.filter((item) => item.status !== SessionStatus.Cancelled)

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

  return {
    today,
    period,
    vdot: points.map((point, index) => ({
      date: point.date,
      vdot: point.vdot,
      origin: point.origin,
      isFloor: point.isFloor,
      cause: causeOf(point, index),
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
    /** Part des séances prévues effectivement réalisées ; une séance retirée n'en est pas une (§ 5). */
    adherence: counted.length === 0 ? null : Math.round((done.length / counted.length) * 100),
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
      days: sessionDays(pastSessions, today),
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
    strengthLoads: strengthSeries(strength),
  }
})
