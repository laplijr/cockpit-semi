import { z } from 'zod'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

const bodySchema = z.object({
  trigger: z.nativeEnum(PlanTrigger).default(PlanTrigger.RaceAdded),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { trigger } = await readValidatedBody(event, bodySchema.parse)
  const { planVersionId, plan } = await regeneratePlan(planGateway(athleteId), systemClock, trigger)

  return {
    planVersionId,
    startDate: plan.startDate,
    provisional: plan.provisional,
    weeks: plan.weeks.length,
    phases: plan.phases.length,
  }
})
