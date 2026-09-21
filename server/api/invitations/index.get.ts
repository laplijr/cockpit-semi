import { desc, eq } from 'drizzle-orm'
import { useDatabase } from '../../infra/db/client'
import { invitation, user } from '../../infra/db/schema'
import { currentUserId, requireOwner } from '../../utils/owner'

/** Les invitations émises, pour savoir lesquelles sont encore ouvertes. */
export default defineEventHandler(async (event) => {
  await requireOwner(await currentUserId(event))

  const rows = await useDatabase()
    .select({
      id: invitation.id,
      token: invitation.token,
      label: invitation.label,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      consumedAt: invitation.consumedAt,
      consumedLogin: user.login,
    })
    .from(invitation)
    .leftJoin(user, eq(invitation.consumedBy, user.id))
    .orderBy(desc(invitation.createdAt))

  return rows
})
