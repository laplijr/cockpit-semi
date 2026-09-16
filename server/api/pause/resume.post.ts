import { resumePause } from '../../application/resume-pause'
import { useDatabase } from '../../infra/db/client'
import { createPauseGateway } from '../../infra/db/feedback-gateway'
import { planGateway, systemClock } from '../../utils/context'

/** L'athlète marque lui-même la reprise : c'est elle qui date le plan (§ 0). */
export default defineEventHandler(async () => {
  return resumePause(createPauseGateway(useDatabase()), planGateway(), systemClock)
})
