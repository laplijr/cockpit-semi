import { and, desc, eq, isNull } from 'drizzle-orm'
import type {
  AthleteSnapshot,
  FitnessSnapshot,
  OpenPauseSnapshot,
  PlanGateway,
  PlanParameters,
} from '../../application/ports'
import { DEFAULT_CONSTRAINTS } from '../../domain/athlete/constraints'
import type { GeneratedPlan } from '../../domain/plan/generate'
import type { PlannedRace } from '../../domain/plan/periodization'
import type { PlanTrigger } from '../../domain/plan/session'
import { RaceStatus } from '../../domain/races/race'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { athlete, fitnessPoint, pause, phase, planVersion, race, session, week } from './schema'

export function createPlanGateway(db: Database): PlanGateway {
  return {
    async loadAthlete(): Promise<AthleteSnapshot | undefined> {
      const [row] = await db.select().from(athlete).limit(1)
      if (!row) return undefined
      return { constraints: row.constraints ?? DEFAULT_CONSTRAINTS, onboarded: row.onboarded }
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

    async loadOpenPause(): Promise<OpenPauseSnapshot | undefined> {
      const [row] = await db
        .select()
        .from(pause)
        .where(isNull(pause.endDate))
        .orderBy(desc(pause.startDate))
        .limit(1)
      if (!row) return undefined
      return {
        id: row.id,
        type: row.type,
        zone: row.zone,
        startDate: row.startDate,
        estimatedEndDate: row.estimatedEndDate,
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
          })
          .returning({ id: week.id })

        if (generated.sessions.length === 0) continue

        await db.insert(session).values(
          generated.sessions.map((item) => ({
            weekId: stored!.id,
            date: item.date,
            sport: Sport.Running,
            code: item.code,
            prescription: item.prescription as unknown as Record<string, unknown>,
            key: item.key,
          })),
        )
      }

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
          .where(and(eq(week.planVersionId, version.id)))
          .orderBy(session.date)

  return {
    version,
    phases,
    weeks,
    sessions: sessions.map((row) => row.session),
  }
}
