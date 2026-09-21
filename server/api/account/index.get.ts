import { STORED_DATA } from '../../application/accounts'
import { currentAthleteId } from '../../utils/context'
import { currentUser, currentUserId, isOwner } from '../../utils/owner'
import { usageToday } from '../../utils/quota'

/** Ce que le cockpit garde de toi, pourquoi, et ce qu'il a consommé aujourd'hui. */
export default defineEventHandler(async (event) => {
  const userId = await currentUserId(event)
  const athleteId = await currentAthleteId(event)
  const account = await currentUser(userId)

  return {
    login: account?.login ?? null,
    createdAt: account?.createdAt ?? null,
    owner: await isOwner(userId),
    stored: STORED_DATA,
    usage: await usageToday(athleteId),
  }
})
