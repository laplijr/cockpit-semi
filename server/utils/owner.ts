import { asc, eq } from 'drizzle-orm'
import { useDatabase } from '../infra/db/client'
import { user } from '../infra/db/schema'

/**
 * Le premier compte créé est celui de Ronan : c'est lui qui invite. Rien à
 * stocker de plus — un drapeau « propriétaire » serait une colonne qui répète
 * ce que l'ordre des identifiants dit déjà (§ 9, P8.4).
 */
export async function isOwner(userId: number): Promise<boolean> {
  const [first] = await useDatabase()
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.id))
    .limit(1)
  return first?.id === userId
}

export async function requireOwner(userId: number): Promise<void> {
  if (await isOwner(userId)) return
  throw createError({ statusCode: 403, statusMessage: 'Réservé au compte principal.' })
}

/** Compte de la session courante ; 401 quand il n'y en a pas. */
export async function currentUserId(event: Parameters<typeof getUserSession>[0]): Promise<number> {
  const session = await getUserSession(event)
  const id = (session.user as { id?: number } | undefined)?.id
  if (typeof id !== 'number') {
    throw createError({ statusCode: 401, statusMessage: 'Session sans compte.' })
  }
  return id
}

export async function currentUser(userId: number) {
  const [row] = await useDatabase().select().from(user).where(eq(user.id, userId)).limit(1)
  return row
}
