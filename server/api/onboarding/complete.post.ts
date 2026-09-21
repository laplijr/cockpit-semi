import { eq } from 'drizzle-orm'
import { regeneratePlan } from '../../application/regenerate-plan'
import { PlanTrigger } from '../../domain/plan/session'
import { useDatabase } from '../../infra/db/client'
import { athlete } from '../../infra/db/schema'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

/** La seule génération de l'onboarding : les cinq étapes précédentes écrivent sans régénérer. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const [saved] = await useDatabase()
    .update(athlete)
    .set({ onboarded: true })
    .where(eq(athlete.id, athleteId))
    .returning()

  const { plan } = await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.Onboarding)
  return { athlete: saved, weeks: plan.weeks.length }
})
