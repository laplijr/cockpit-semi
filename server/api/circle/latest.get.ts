import { latestPostAt } from '../../infra/db/circle-gateway'
import { useDatabase } from '../../infra/db/client'
import { currentAthleteId } from '../../utils/context'
import { circleMember } from '../../utils/scope'

/**
 * La dernière publication de quelqu'un d'autre. C'est tout ce qu'il faut pour
 * le point de non-lu : **un point, pas un nombre** — un compteur de non-lus
 * est une dette, et lire ce que font les autres n'en est pas une (§ 8, P9).
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  await circleMember(db, athleteId)

  return { latest: await latestPostAt(db, athleteId) }
})
