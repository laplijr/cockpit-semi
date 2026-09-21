import { z } from 'zod'
import { draftUnplanned } from '../../application/record-unplanned'
import { useDatabase } from '../../infra/db/client'
import { createUnplannedGateway } from '../../infra/db/unplanned-gateway'
import { createUnplannedInterpreter } from '../../infra/llm/unplanned'
import { ExternalCall } from '../../domain/shared/external-call'
import { currentAthleteId, systemClock } from '../../utils/context'
import { withExternalCall } from '../../utils/quota'

const bodySchema = z.object({ text: z.string().min(3).max(1000) })

/** Traduit le texte libre en événements, sans rien appliquer (§ 6). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { text } = await readValidatedBody(event, bodySchema.parse)
  return withExternalCall(athleteId, ExternalCall.Unplanned, () =>
    draftUnplanned(
      createUnplannedGateway(useDatabase(), athleteId),
      createUnplannedInterpreter(),
      systemClock,
      text,
    ),
  )
})
