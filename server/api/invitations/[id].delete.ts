import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { invitation } from '../../infra/db/schema'
import { currentUserId, requireOwner } from '../../utils/owner'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

/** Révoque une invitation qui n'a pas encore servi. */
export default defineEventHandler(async (event) => {
  await requireOwner(await currentUserId(event))
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const removed = await useDatabase()
    .delete(invitation)
    .where(and(eq(invitation.id, id), isNull(invitation.consumedAt)))
    .returning({ id: invitation.id })

  if (removed.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Invitation inconnue ou déjà consommée.' })
  }

  return { ok: true }
})
