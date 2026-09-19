import { z } from 'zod'
import { readMealPlan } from '../../infra/db/meal-plan-gateway'
import { useDatabase } from '../../infra/db/client'

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

/** Lecture seule : un jour sans proposition renvoie l'absence, il ne la crée pas. */
export default defineEventHandler(async (event) => {
  const { date } = await getValidatedQuery(event, querySchema.parse)

  const row = await readMealPlan(useDatabase(), date)
  if (!row) return { date, meals: null, generatedAt: null }

  return { date, meals: row.meals, generatedAt: row.generatedAt }
})
