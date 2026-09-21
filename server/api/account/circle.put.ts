import { z } from 'zod'
import { isMember, setMembership } from '../../infra/db/circle-gateway'
import { useDatabase } from '../../infra/db/client'
import { currentAthleteId } from '../../utils/context'

const bodySchema = z.object({ member: z.boolean() })

/**
 * Rejoindre ou quitter le cercle, depuis « Mes données ». Quitter ferme
 * l'appartenance et rien d'autre : les publications restent, et c'est la
 * suppression du compte — elle existe déjà — qui efface tout (§ 9, P9.2).
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  const { member } = await readValidatedBody(event, bodySchema.parse)

  await setMembership(db, athleteId, member)
  return { member: await isMember(db, athleteId) }
})
