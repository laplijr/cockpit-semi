import { count, eq } from 'drizzle-orm'
import {
  MIN_AVAILABLE_DAYS,
  isUntouched,
  resumeStep,
  type OnboardingState,
} from '../../domain/athlete/onboarding'
import { useDatabase } from '../../infra/db/client'
import { athlete, fitnessPoint, race } from '../../infra/db/schema'
import { currentAthleteId, systemClock } from '../../utils/context'

/**
 * Où reprendre, et ce qui est déjà répondu. L'avancement n'est pas stocké :
 * il se déduit des traces laissées en base (§ 9, P8.2).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const [[row], [fitness], [races]] = await Promise.all([
    db.select().from(athlete).where(eq(athlete.id, athleteId)).limit(1),
    db.select({ total: count() }).from(fitnessPoint).where(eq(fitnessPoint.athleteId, athleteId)),
    db.select({ total: count() }).from(race).where(eq(race.athleteId, athleteId)),
  ])

  const state: OnboardingState = {
    hasIdentity: Boolean(row?.firstName),
    hasLevel: Boolean(row?.profile),
    hasFitness: (fitness?.total ?? 0) > 0,
    hasObjective: (races?.total ?? 0) > 0,
    hasConstraints: (row?.constraints?.availableDays.length ?? 0) >= MIN_AVAILABLE_DAYS,
  }

  /** Le jour de l'app, horloge simulée comprise : la page n'en invente pas un (§ P3.5). */
  return {
    state,
    step: resumeStep(state),
    untouched: isUntouched(state),
    today: systemClock.today(),
  }
})
