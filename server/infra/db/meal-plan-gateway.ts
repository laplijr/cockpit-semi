import { and, asc, eq, gte } from 'drizzle-orm'
import type { MealDay, MealPlanGateway, StoredMealPlan } from '../../application/generate-meal-plan'
import { dayKindOf, type DaySession } from '../../domain/nutrition/daily'
import { sessionsKeyOf } from '../../domain/nutrition/meal'
import { defaultStartHour, mealTiming } from '../../domain/nutrition/meal-timing'
import { addDays, type IsoDate } from '../../domain/plan/calendar'
import { RaceStatus } from '../../domain/races/race'
import { prescribedDurationMin, type Prescription } from '../../domain/shared/prescription'
import type { Database } from './client'
import { loadActivePlanVersion } from './plan-gateway'
import { athlete, mealPlan, race } from './schema'

export function createMealPlanGateway(db: Database, athleteId: number): MealPlanGateway {
  return {
    loadDay: (date) => loadDay(db, athleteId, date),
    read: (date) => readMealPlan(db, athleteId, date),

    async save(plan) {
      const [saved] = await db
        .insert(mealPlan)
        .values({ ...plan, athleteId })
        .onConflictDoUpdate({
          target: [mealPlan.athleteId, mealPlan.date],
          set: {
            dayKind: plan.dayKind,
            sessionsKey: plan.sessionsKey,
            meals: plan.meals,
            generatedAt: new Date(),
          },
        })
        .returning()

      return { ...plan, generatedAt: saved!.generatedAt }
    },
  }
}

/** Lecture seule : un jour sans proposition n'en déclenche jamais une (§ 1). */
export async function readMealPlan(
  db: Database,
  athleteId: number,
  date: IsoDate,
): Promise<StoredMealPlan | undefined> {
  const [row] = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.athleteId, athleteId), eq(mealPlan.date, date)))
    .limit(1)
  return row
}

export async function readMealPlans(db: Database, athleteId: number, dates: IsoDate[]) {
  const rows = await Promise.all(dates.map((date) => readMealPlan(db, athleteId, date)))
  return new Map(rows.filter(Boolean).map((row) => [row!.date, row!]))
}

async function loadDay(db: Database, athleteId: number, date: IsoDate): Promise<MealDay> {
  const tomorrow = addDays(date, 1)

  const [[profile], active, races] = await Promise.all([
    db
      .select({ weightKg: athlete.weightKg })
      .from(athlete)
      .where(eq(athlete.id, athleteId))
      .limit(1),
    loadActivePlanVersion(db, athleteId),
    db
      .select({ date: race.date })
      .from(race)
      .where(
        and(
          eq(race.athleteId, athleteId),
          eq(race.status, RaceStatus.Planned),
          gte(race.date, date),
        ),
      )
      .orderBy(asc(race.date)),
  ])

  const sessionsOn = (on: IsoDate): DaySession[] =>
    (active?.sessions ?? [])
      .filter((session) => session.date === on)
      .map((session) => ({
        sport: session.sport,
        code: session.code,
        key: session.key,
        durationMin: prescribedDurationMin(session.prescription as unknown as Prescription),
      }))

  const today = sessionsOn(date)
  const dayKind = dayKindOf(
    today,
    races.some((row) => row.date === date),
  )

  return {
    dayKind,
    weightKg: profile?.weightKg ?? null,
    sessionsKey: sessionsKeyOf(today),
    slots: mealTiming(
      today.map((session) => ({ ...session, startHour: defaultStartHour(session) })),
      dayKind,
    ),
    sessions: [
      ...today.map((session) => ({ day: 'aujourd_hui' as const, ...strip(session) })),
      ...sessionsOn(tomorrow).map((session) => ({ day: 'demain' as const, ...strip(session) })),
    ],
  }
}

function strip(session: DaySession) {
  return { sport: session.sport, code: session.code, durationMin: session.durationMin }
}
