import { STORED_DATA } from '../../domain/account/account'
import { circleMembers, isMember } from '../../infra/db/circle-gateway'
import { useDatabase } from '../../infra/db/client'
import { currentAthleteId } from '../../utils/context'
import { currentUser, currentUserId, isOwner } from '../../utils/owner'
import { usageToday } from '../../utils/quota'

/** Ce que le cockpit garde de toi, pourquoi, et ce qu'il a consommé aujourd'hui. */
export default defineEventHandler(async (event) => {
  const userId = await currentUserId(event)
  const athleteId = await currentAthleteId(event)
  const account = await currentUser(userId)

  /** La liste des membres ne se lit qu'en étant du cercle : en partir, c'est ne plus voir. */
  const db = useDatabase()
  const member = await isMember(db, athleteId)

  return {
    circle: { member, members: member ? await circleMembers(db) : [] },
    login: account?.login ?? null,
    createdAt: account?.createdAt ?? null,
    owner: await isOwner(userId),
    stored: STORED_DATA,
    usage: await usageToday(athleteId),
  }
})
