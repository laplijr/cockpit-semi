import { z } from 'zod'
import { restoreDay } from '../../../application/edit-plan-session'
import { regeneratePlan } from '../../../application/regenerate-plan'
import { PlanTrigger } from '../../../domain/plan/session'
import { useDatabase } from '../../../infra/db/client'
import { createPlanEditGateway } from '../../../infra/db/plan-edit-gateway'
import { isoDateSchema } from '../../../utils/session-draft'
import { currentAthleteId, planGateway, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ date: isoDateSchema })

/**
 * Rend une journée au moteur : les séances posées à la main disparaissent et
 * le plan se régénère, ce qui repose la journée telle qu'il la voulait.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { date } = await getValidatedRouterParams(event, paramsSchema.parse)

  const result = await restoreDay(createPlanEditGateway(useDatabase(), athleteId), date)
  await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.DayRestored)

  return result
})
