import { DAILY_TARGETS, type DailyTargets, type DayKind } from '../domain/nutrition/daily'
import type { Meal } from '../domain/nutrition/meal'
import type { MealSlot } from '../domain/nutrition/meal-timing'
import type { IsoDate } from '../domain/plan/calendar'

/** Ce que le modèle reçoit ; le contrat vit dans `infra/llm/meals` (§ 6). */
export interface MealContext {
  date: IsoDate
  dayKind: DayKind
  slots: MealSlot[]
  targets: DailyTargets
  weightKg: number | null
  sessions: { day: 'aujourd_hui' | 'demain'; sport: string; code: string; durationMin: number }[]
  readinessScore: number | null
}

export interface MealPlanner {
  propose(context: MealContext): Promise<Meal[]>
}

/** La journée telle que le plan la donne, une fois les créneaux posés. */
export interface MealDay {
  dayKind: DayKind
  weightKg: number | null
  /** Signature des séances du jour : elle dit si la proposition a vieilli. */
  sessionsKey: string
  slots: MealSlot[]
  sessions: MealContext['sessions']
}

export interface StoredMealPlan {
  date: IsoDate
  dayKind: string
  sessionsKey: string
  meals: Meal[]
  generatedAt: Date
}

export interface MealPlanGateway {
  loadDay(date: IsoDate): Promise<MealDay>
  read(date: IsoDate): Promise<StoredMealPlan | undefined>
  save(plan: Omit<StoredMealPlan, 'generatedAt'>): Promise<StoredMealPlan>
}

/**
 * La proposition de repas d'un jour. Elle est servie depuis le cache tant que
 * les séances du jour n'ont pas bougé ; sinon le modèle est rappelé (§ 9,
 * P6.4). Seul ce cas d'usage appelle le modèle : aucune lecture ne le fait.
 */
export async function generateMealPlan(
  gateway: MealPlanGateway,
  planner: MealPlanner,
  date: IsoDate,
  readinessScore: number | null,
): Promise<StoredMealPlan> {
  const day = await gateway.loadDay(date)
  const cached = await gateway.read(date)

  if (cached && cached.sessionsKey === day.sessionsKey) return cached

  const meals = await planner.propose({
    date,
    dayKind: day.dayKind,
    slots: day.slots,
    targets: DAILY_TARGETS[day.dayKind],
    weightKg: day.weightKg,
    sessions: day.sessions,
    readinessScore,
  })

  return gateway.save({ date, dayKind: day.dayKind, sessionsKey: day.sessionsKey, meals })
}
