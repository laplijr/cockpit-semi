import { z } from 'zod'
import { newInvitationToken } from '../../application/accounts'
import { invitationExpiry } from '../../domain/account/account'
import { useDatabase } from '../../infra/db/client'
import { invitation } from '../../infra/db/schema'
import { currentUserId, requireOwner } from '../../utils/owner'

const bodySchema = z.object({ label: z.string().max(60).nullable().default(null) })

/** Génère un lien d'invitation. Il se transmet de la main à la main (§ 9, P8.4). */
export default defineEventHandler(async (event) => {
  await requireOwner(await currentUserId(event))
  const { label } = await readValidatedBody(event, bodySchema.parse)

  const [row] = await useDatabase()
    .insert(invitation)
    .values({
      token: newInvitationToken(),
      label: label?.trim() || null,
      expiresAt: invitationExpiry(new Date()),
    })
    .returning()

  return row
})
