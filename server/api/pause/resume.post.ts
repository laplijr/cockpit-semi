import { isNull } from 'drizzle-orm'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { useDatabase } from '../../infra/db/client'
import { pause } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

/** L'athlète marque lui-même la reprise : c'est elle qui date le plan (§ 0). */
export default defineEventHandler(async () => {
  const today = systemClock.today()

  await useDatabase().update(pause).set({ endDate: today }).where(isNull(pause.endDate))
  const { plan } = await regeneratePlan(planGateway(), systemClock, PlanTrigger.Resume)

  return { resumedOn: today, startDate: plan.startDate, weeks: plan.weeks.length }
})
