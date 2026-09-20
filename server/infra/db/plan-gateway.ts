import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray } from 'drizzle-orm'
import type {
  AthleteSnapshot,
  FitnessSnapshot,
  ForecastContext,
  ForecastResolution,
  IssuedForecast,
  PauseSnapshot,
  PlanGateway,
  PlanParameters,
} from '../../application/ports'
import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../../domain/athlete/constraints'
import { STANDARD_INCREASE_PCT, defaultsFor } from '../../domain/athlete/profile'
import type { IsoDate } from '../../domain/plan/calendar'
import type { GeneratedPlan } from '../../domain/plan/generate'
import type { PlannedRace } from '../../domain/plan/periodization'
import { SessionOrigin, SessionStatus, type PlanTrigger } from '../../domain/plan/session'
import type { ForecastTarget } from '../../domain/fitness/accuracy'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { VDOT_GAIN_PER_BLOCK } from '../../domain/fitness/projection'
import { ObjectiveMode, RaceStatus } from '../../domain/races/race'
import { personalRecords, recordFor } from '../../domain/races/records'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import {
  athlete,
  feedback,
  fitnessPoint,
  forecast,
  pause,
  phase,
  planVersion,
  race,
  session,
  week,
} from './schema'

export function createPlanGateway(db: Database): PlanGateway {
  return {
    async loadAthlete(): Promise<AthleteSnapshot | undefined> {
      const [row] = await db.select().from(athlete).limit(1)
      if (!row) return undefined
      return {
        constraints: row.constraints ?? DEFAULT_CONSTRAINTS,
        startWeeklyVolumeM: row.startWeeklyVolumeM ?? DEFAULT_START_VOLUME_M,
        peakWeeklyVolumeM: row.peakWeeklyVolumeM ?? DEFAULT_PEAK_VOLUME_M,
        maxWeeklyIncreasePct: row.profile
          ? defaultsFor(row.profile).maxWeeklyIncreasePct
          : STANDARD_INCREASE_PCT,
        vdotGainPerBlock: row.vdotGainPerBlock ?? VDOT_GAIN_PER_BLOCK,
        onboarded: row.onboarded,
      }
    },

    async loadRaces(): Promise<PlannedRace[]> {
      const rows = await db.select().from(race).where(eq(race.status, RaceStatus.Planned))
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        date: row.date,
        distanceM: row.distanceM,
        priority: row.priority,
        objectiveMode: row.objectiveMode,
      }))
    },

    async loadLatestPause(): Promise<PauseSnapshot | undefined> {
      const [row] = await db.select().from(pause).orderBy(desc(pause.startDate)).limit(1)
      if (!row) return undefined
      return {
        id: row.id,
        type: row.type,
        zone: row.zone,
        startDate: row.startDate,
        estimatedEndDate: row.estimatedEndDate,
        endDate: row.endDate,
        allowances: row.allowances,
        watchZones: row.watchZones,
        notes: row.notes,
      }
    },

    async loadCurrentFitness(): Promise<FitnessSnapshot | undefined> {
      const [row] = await db
        .select()
        .from(fitnessPoint)
        .orderBy(desc(fitnessPoint.date), desc(fitnessPoint.id))
        .limit(1)
      if (!row) return undefined
      return { vdot: row.vdot, isFloor: row.isFloor, date: row.date }
    },

    async loadLastTestDate(): Promise<string | null> {
      const [row] = await db
        .select({ date: fitnessPoint.date })
        .from(fitnessPoint)
        .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
        .orderBy(desc(fitnessPoint.date))
        .limit(1)
      return row?.date ?? null
    },

    async savePlan(
      plan: GeneratedPlan,
      trigger: PlanTrigger,
      parameters: PlanParameters,
    ): Promise<number> {
      /** La version qu'on remplace : c'est d'elle, et d'elle seule, qu'on reprend. */
      const [superseded] = await db
        .select({ id: planVersion.id })
        .from(planVersion)
        .orderBy(desc(planVersion.createdAt), desc(planVersion.id))
        .limit(1)

      const [version] = await db
        .insert(planVersion)
        .values({ trigger, parameters, startDate: plan.startDate })
        .returning({ id: planVersion.id })

      const planVersionId = version!.id

      if (plan.phases.length > 0) {
        await db.insert(phase).values(
          plan.phases.map((item) => ({
            planVersionId,
            type: item.type,
            startWeek: item.startWeek,
            endWeek: item.endWeek,
            raceId: item.raceId,
          })),
        )
      }

      for (const generated of plan.weeks) {
        const [stored] = await db
          .insert(week)
          .values({
            planVersionId,
            index: generated.index,
            startDate: generated.startDate,
            endDate: generated.endDate,
            phaseType: generated.phaseType,
            raceId: generated.raceId,
            targetRunM: generated.targetRunM,
            longRunMaxM: generated.longRunMaxM,
            light: generated.light,
            comebackRatio: generated.comebackRatio ?? null,
            phaseProgress: generated.phaseProgress,
            test: generated.test,
            runs: generated.runs,
            targetCyclingMin: generated.targetCyclingMin,
            targetStrengthCount: generated.targetStrengthCount,
            volumeCapped: generated.volumeCapped,
          })
          .returning({ id: week.id })

        const rows = [
          ...generated.sessions.map((item) => ({
            weekId: stored!.id,
            date: item.date,
            sport: Sport.Running,
            code: item.code as string,
            prescription: item.prescription as unknown as Record<string, unknown>,
            key: item.key,
          })),
          ...generated.support.map((item) => ({
            weekId: stored!.id,
            date: item.date,
            sport: item.sport,
            code: item.code as string,
            prescription: item.prescription as unknown as Record<string, unknown>,
            key: false,
          })),
        ]

        if (rows.length === 0) continue

        await db.insert(session).values(rows)
      }

      // Un jour touché à la main reste tel que Ronan l'a laissé (§ 5, P6.43).
      await freezeManualDays(db, planVersionId, superseded?.id, plan.startDate)

      // Une version périmée ne garde que son historique : ses séances encore
      // prévues sont remplacées par celles de la nouvelle version.
      await db
        .delete(session)
        .where(
          and(
            eq(session.status, SessionStatus.Planned),
            notInArray(
              session.weekId,
              db.select({ id: week.id }).from(week).where(eq(week.planVersionId, planVersionId)),
            ),
          ),
        )

      return planVersionId
    },

    async loadForecastContext(): Promise<ForecastContext> {
      const [tests, races, open] = await Promise.all([
        db
          .select({ date: fitnessPoint.date, vdot: fitnessPoint.vdot })
          .from(fitnessPoint)
          .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
          .orderBy(asc(fitnessPoint.date)),
        /** Une course annulée n'annonce rien et ne juge rien : elle sort du lot. */
        db.select().from(race).where(ne(race.status, RaceStatus.Cancelled)).orderBy(asc(race.date)),
        db
          .select()
          .from(forecast)
          .where(isNull(forecast.actualVdot))
          .orderBy(asc(forecast.issuedDate)),
      ])

      /** En mode record, la cible est le meilleur chrono représentatif (§ 5). */
      const records = personalRecords(races)
      const targetOf = (row: (typeof races)[number]) =>
        row.objectiveMode === ObjectiveMode.Record
          ? (recordFor(records, row.distanceM)?.timeS ?? null)
          : row.objectifS

      return {
        tests,
        races: races.map((row) => ({
          id: row.id,
          date: row.date,
          distanceM: row.distanceM,
          elevationGainM: row.elevationGainM,
          expectedTempC: row.expectedTempC,
          targetS: targetOf(row),
          /** Un chrono non représentatif ne dit pas la forme : il ne résout rien. */
          resultS: row.representative ? row.resultatS : null,
        })),
        open: open.map((row) => ({
          id: row.id,
          target: row.target as ForecastTarget,
          raceId: row.raceId,
          issuedDate: row.issuedDate,
          projectedVdot: row.projectedVdot,
        })),
      }
    },

    async saveForecasts(resolved: ForecastResolution[], issued: IssuedForecast[]): Promise<void> {
      for (const item of resolved) {
        await db
          .update(forecast)
          .set({
            actualVdot: item.actualVdot,
            gapVdot: item.gapVdot,
            resolvedDate: item.resolvedDate,
          })
          .where(eq(forecast.id, item.id))
      }

      if (issued.length > 0) await db.insert(forecast).values(issued)
    },
  }
}

/**
 * Report des journées posées à la main dans la version neuve. Sans lui, une
 * séance ajoutée dimanche disparaîtrait au premier test 20′ enregistré : la
 * régénération ne garde que ce qu'elle produit. La journée entière suit, pas
 * seulement la séance retouchée — sinon la muscu du même jour serait perdue
 * en chemin (§ 5, P6.43).
 */
async function freezeManualDays(
  db: Database,
  planVersionId: number,
  previousVersionId: number | undefined,
  from: IsoDate | null,
) {
  if (from === null || previousVersionId === undefined) return

  const marked = await db
    .select({ date: session.date })
    .from(session)
    .where(and(eq(session.origin, SessionOrigin.Manual), gte(session.date, from)))
  if (marked.length === 0) return

  const weeks = await db.select().from(week).where(eq(week.planVersionId, planVersionId))
  const carried = [SessionStatus.Planned, SessionStatus.Modified, SessionStatus.Cancelled]

  /**
   * Seule la version qu'on remplace est reprise. Sans cette borne, une séance
   * orpheline d'une version bien plus ancienne serait ressuscitée sur la même
   * date, et les fantômes s'accumuleraient à chaque régénération.
   */
  const previousWeeks = db
    .select({ id: week.id })
    .from(week)
    .where(eq(week.planVersionId, previousVersionId))

  for (const date of new Set(marked.map((row) => row.date))) {
    const target = weeks.find((item) => item.startDate <= date && date <= item.endDate)
    if (!target) continue

    // Ce que le générateur vient de poser ce jour-là cède la place.
    await db.delete(session).where(and(eq(session.date, date), eq(session.weekId, target.id)))

    await db
      .update(session)
      .set({ weekId: target.id, origin: SessionOrigin.Manual })
      .where(
        and(
          eq(session.date, date),
          inArray(session.status, carried),
          inArray(session.weekId, previousWeeks),
        ),
      )
  }
}

/** Dernière version générée : c'est elle, le plan actif (§ 4). */
export async function loadActivePlanVersion(db: Database) {
  const [version] = await db
    .select()
    .from(planVersion)
    .orderBy(desc(planVersion.createdAt), desc(planVersion.id))
    .limit(1)
  if (!version) return undefined

  const [phases, weeks] = await Promise.all([
    db.select().from(phase).where(eq(phase.planVersionId, version.id)).orderBy(phase.startWeek),
    db.select().from(week).where(eq(week.planVersionId, version.id)).orderBy(week.index),
  ])

  const sessions =
    weeks.length === 0
      ? []
      : await db
          .select()
          .from(session)
          .innerJoin(week, eq(session.weekId, week.id))
          /** Le RPE réel sert au « prescrit contre réalisé » du dialog de séance (§ 8). */
          .leftJoin(feedback, eq(feedback.sessionId, session.id))
          .where(and(eq(week.planVersionId, version.id)))
          .orderBy(session.date)

  return {
    version,
    phases,
    weeks,
    sessions: sessions.map((row) => ({ ...row.session, feedbackRpe: row.feedback?.rpe ?? null })),
  }
}
