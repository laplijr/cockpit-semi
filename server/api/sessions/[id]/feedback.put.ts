import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { Sensation } from '../../../domain/load/feedback'
import { SessionStatus } from '../../../domain/plan/session'
import { useDatabase } from '../../../infra/db/client'
import { recomputeLoadFor } from '../../../infra/db/load-repository'
import { feedback, session } from '../../../infra/db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const bodySchema = z.object({
  rpe: z.number().int().min(1).max(10),
  sensations: z.array(z.nativeEnum(Sensation)).default([]),
  sleepHours: z.number().min(0).max(24).nullable().default(null),
  pain: z
    .object({ zone: z.string().min(1), intensity: z.number().int().min(0).max(10) })
    .nullable()
    .default(null),
  durationMin: z.number().positive(),
  distanceM: z.number().positive().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const [target] = await db.select().from(session).where(eq(session.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  const values = {
    rpe: body.rpe,
    sensations: body.sensations,
    sleepHours: body.sleepHours,
    pain: body.pain,
    notes: body.notes,
  }

  await db
    .insert(feedback)
    .values({ sessionId: id, ...values })
    .onConflictDoUpdate({ target: feedback.sessionId, set: values })

  await db
    .update(session)
    .set({
      status: SessionStatus.Done,
      actualDurationMin: body.durationMin,
      actualDistanceM: body.distanceM,
    })
    .where(eq(session.id, id))

  return { ok: true, load: await recomputeLoadFor(db, target.date) }
})
