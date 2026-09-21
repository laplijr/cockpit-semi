import { z } from 'zod'
import { toggleBravo } from '../../../../infra/db/circle-gateway'
import { useDatabase } from '../../../../infra/db/client'
import { currentAthleteId } from '../../../../utils/context'
import { visiblePost } from '../../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Bravo est une bascule : le redire, c'est le retirer. */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const target = await visiblePost(db, athleteId, id)
  return { mine: await toggleBravo(db, athleteId, target.id) }
})
