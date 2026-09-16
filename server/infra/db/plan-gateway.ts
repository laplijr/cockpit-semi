import { and, desc, eq, notInArray } from 'drizzle-orm'
import type {
  AthleteSnapshot,
  FitnessSnapshot,
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
import type { GeneratedPlan } from '../../domain/plan/generate'
import type { PlannedRace } from '../../domain/plan/periodization'
import { SessionStatus, type PlanTrigger } from '../../domain/plan/session'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { RaceStatus } from '../../domain/races/race'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import {
  athlete,
  feedback,
  fitnessPoint,
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
