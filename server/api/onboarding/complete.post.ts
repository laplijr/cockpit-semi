import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { useDatabase } from '../../infra/db/client'
import { athlete } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

/** La seule génération de l'onboarding : les cinq étapes précédentes écrivent sans régénérer. */
export default defineEventHandler(async () => {
  const [saved] = await useDatabase()
    .insert(athlete)
    .values({ id: 1, onboarded: true })
    .onConflictDoUpdate({ target: athlete.id, set: { onboarded: true } })
    .returning()

  const { plan } = await regeneratePlan(planGateway(), systemClock, PlanTrigger.Onboarding)
  return { athlete: saved, weeks: plan.weeks.length }
})
