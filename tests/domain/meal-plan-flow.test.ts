import { describe, expect, it } from 'vitest'
import {
  generateMealPlan,
  type MealContext,
  type MealDay,
  type MealPlanGateway,
  type StoredMealPlan,
} from '~~/server/application/generate-meal-plan'
import { DayKind } from '~~/server/domain/nutrition/daily'
import type { Meal } from '~~/server/domain/nutrition/meal'
import { MealEmphasis, MealKind } from '~~/server/domain/nutrition/meal-timing'

const SLOTS = [
  { kind: MealKind.Breakfast, hour: 7, emphasis: MealEmphasis.Normal },
  { kind: MealKind.Lunch, hour: 12.5, emphasis: MealEmphasis.Normal },
  { kind: MealKind.Dinner, hour: 20, emphasis: MealEmphasis.Normal },
]

const day = (sessionsKey: string): MealDay => ({
  dayKind: DayKind.Easy,
  weightKg: 72,
  sessionsKey,
  slots: SLOTS,
  sessions: [],
})

function fakePlanner() {
  const calls: MealContext[] = []
  return {
    calls,
    async propose(context: MealContext): Promise<Meal[]> {
      calls.push(context)
      return context.slots.map((slot) => ({
        ...slot,
        name: `repas ${calls.length}`,
        description: 'des aliments',
      }))
    },
  }
}

function fakeGateway(sessionsKey: string) {
  let stored: StoredMealPlan | undefined
  const gateway: MealPlanGateway & { current: () => StoredMealPlan | undefined; key: string } = {
    key: sessionsKey,
    current: () => stored,
    async loadDay() {
      return day(gateway.key)
    },
    async read() {
      return stored
    },
    async save(plan) {
      stored = { ...plan, generatedAt: new Date('2026-11-22T09:00:00Z') }
      return stored
    },
  }
  return gateway
}

describe('plan de repas du jour (§ 9, P6.4)', () => {
  it('appelle le modèle la première fois, avec les repères et les créneaux', async () => {
    const gateway = fakeGateway('course:EF:50')
    const planner = fakePlanner()

    const plan = await generateMealPlan(gateway, planner, '2026-11-22', 63)

    expect(planner.calls).toHaveLength(1)
    expect(planner.calls[0]).toMatchObject({
      date: '2026-11-22',
      dayKind: DayKind.Easy,
      weightKg: 72,
      readinessScore: 63,
    })
    expect(planner.calls[0]!.targets.carbsGPerKg).toEqual([5, 7])
    expect(plan.meals).toHaveLength(3)
  })

  it('ressert le cache tant que les séances du jour n’ont pas bougé', async () => {
    const gateway = fakeGateway('course:EF:50')
    const planner = fakePlanner()

    await generateMealPlan(gateway, planner, '2026-11-22', null)
    const again = await generateMealPlan(gateway, planner, '2026-11-22', null)

    expect(planner.calls).toHaveLength(1)
    expect(again.meals[0]!.name).toBe('repas 1')
  })

  it('régénère quand le plan du jour a changé', async () => {
    const gateway = fakeGateway('course:EF:50')
    const planner = fakePlanner()

    await generateMealPlan(gateway, planner, '2026-11-22', null)
    gateway.key = 'course:SL:100'
    const again = await generateMealPlan(gateway, planner, '2026-11-22', null)

    expect(planner.calls).toHaveLength(2)
    expect(again.meals[0]!.name).toBe('repas 2')
    expect(gateway.current()?.sessionsKey).toBe('course:SL:100')
  })

  it('garde l’heure et le rôle du moteur : le modèle ne remplit que le contenu', async () => {
    const plan = await generateMealPlan(fakeGateway('vide'), fakePlanner(), '2026-11-22', null)

    expect(plan.meals.map((meal) => meal.hour)).toEqual([7, 12.5, 20])
    expect(plan.meals.map((meal) => meal.kind)).toEqual([
      MealKind.Breakfast,
      MealKind.Lunch,
      MealKind.Dinner,
    ])
  })
})
