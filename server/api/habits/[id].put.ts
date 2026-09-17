import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { HabitStatus } from '../../domain/learning/habit'
import { useDatabase } from '../../infra/db/client'
import { habit } from '../../infra/db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  status: z.enum([HabitStatus.Accepted, HabitStatus.Refused, HabitStatus.Detected]),
})

/**
 * Décider d'une habitude. Une habitude acceptée devient une règle R100+ lue par
 * le moteur au prochain recalcul ; refusée, elle reste visible mais muette.
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { status } = await readValidatedBody(event, bodySchema.parse)

  const [updated] = await useDatabase()
    .update(habit)
    .set({
      status,
      decidedAt: status === HabitStatus.Detected ? null : new Date(),
    })
    .where(eq(habit.id, id))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Habitude inconnue' })
  return updated
})
