import { z } from 'zod'
import { restoreDay } from '../../../application/edit-plan-session'
import { regeneratePlan } from '../../../application/regenerate-plan'
import { PlanTrigger } from '../../../domain/plan/session'
import { useDatabase } from '../../../infra/db/client'
import { createPlanEditGateway } from '../../../infra/db/plan-edit-gateway'
import { isoDateSchema } from '../../../utils/session-draft'
import { planGateway, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ date: isoDateSchema })

/**
 * Rend une journée au moteur : les séances posées à la main disparaissent et
 * le plan se régénère, ce qui repose la journée telle qu'il la voulait.
 */
export default defineEventHandler(async (event) => {
  const { date } = await getValidatedRouterParams(event, paramsSchema.parse)

  const result = await restoreDay(createPlanEditGateway(useDatabase()), date)
  await regeneratePlan(planGateway(), systemClock, PlanTrigger.DayRestored)

  return result
})
