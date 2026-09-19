import { z } from 'zod'
import { generateMealPlan } from '../../application/generate-meal-plan'
import { useDatabase } from '../../infra/db/client'
import { createMealPlanGateway } from '../../infra/db/meal-plan-gateway'
import { createMealPlanner } from '../../infra/llm/meals'
import { systemClock } from '../../utils/context'
import { currentReadiness } from '../../utils/readiness-context'

const bodySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

/**
 * Le seul point d'entrée qui appelle le modèle pour les repas : ouvrir un jour
 * ne déclenche jamais de génération (§ 1, principe n° 3). La forme du jour
 * n'entre dans le contexte que pour aujourd'hui — elle ne s'anticipe pas.
 */
export default defineEventHandler(async (event) => {
  const { date } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const today = systemClock.today()

  const score = date === today ? (await currentReadiness(db, today)).score : null

  return generateMealPlan(createMealPlanGateway(db), createMealPlanner(), date, score)
})
