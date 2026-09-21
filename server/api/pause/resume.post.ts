import { resumePause } from '../../application/resume-pause'
import { useDatabase } from '../../infra/db/client'
import { createPauseGateway } from '../../infra/db/feedback-gateway'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

/** L'athlète marque lui-même la reprise : c'est elle qui date le plan (§ 0). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  return resumePause(
    createPauseGateway(useDatabase(), athleteId),
    planGateway(athleteId),
    systemClock,
  )
})
