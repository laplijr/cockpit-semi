import { z } from 'zod'
import { regeneratePlan } from '../application/regenerate-plan'
import { TEST_DURATION_S, vdotFromTest } from '../application/record-test'
import { FitnessOrigin } from '../domain/fitness/fitness-point'
import { PlanTrigger } from '../domain/plan/session'
import { useDatabase } from '../infra/db/client'
import { fitnessPoint } from '../infra/db/schema'
import { planGateway, systemClock } from '../utils/context'

const bodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  distanceM: z.number().positive(),
  durationS: z.number().int().positive().default(TEST_DURATION_S),
})

/** Enregistre un test de terrain : il devient le VDOT courant et régénère le plan. */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const vdot = vdotFromTest(body.distanceM, body.durationS)
  const date = body.date ?? systemClock.today()

  await useDatabase()
    .insert(fitnessPoint)
    .values({
      date,
      vdot,
      origin: FitnessOrigin.Test,
      isFloor: false,
      note: `Test ${Math.round(body.durationS / 60)}′ · ${Math.round(body.distanceM)} m`,
    })

  const { plan } = await regeneratePlan(planGateway(), systemClock, PlanTrigger.TestRecorded)
  return { vdot, date, weeks: plan.weeks.length }
})
