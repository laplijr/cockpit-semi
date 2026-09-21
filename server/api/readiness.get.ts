import { useDatabase } from '../infra/db/client'
import { currentAthleteId, systemClock } from '../utils/context'
import { currentReadiness } from '../utils/readiness-context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  return currentReadiness(useDatabase(), athleteId, systemClock.today())
})
