import { useDatabase } from '../infra/db/client'
import { systemClock } from '../utils/context'
import { currentReadiness } from '../utils/readiness-context'

export default defineEventHandler(async () => {
  return currentReadiness(useDatabase(), systemClock.today())
})
