import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { user } from '../../infra/db/schema'

const bodySchema = z.object({ login: z.string().min(1).max(60), password: z.string().min(1) })

/**
 * Un seul message d'erreur, quelle que soit la cause : dire lequel des deux
 * est faux dirait qui a un compte ici (§ 9, P8.4).
 */
const REFUSAL = 'Identifiant ou mot de passe incorrect'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.login, body.login.trim().toLowerCase()))
    .limit(1)

  /**
   * Sans compte, on vérifie quand même un mot de passe : sinon la réponse
   * arrive plus vite, et le délai dit à lui seul que l'identifiant n'existe pas.
   */
  const hash = row?.passwordHash ?? (await missingAccountHash())
  const ok = await verifyPassword(hash, body.password)

  if (!row || !ok) throw createError({ statusCode: 401, statusMessage: REFUSAL })

  await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, row.id))
  await setUserSession(event, {
    user: { id: row.id, login: row.login, athleteId: row.athleteId },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})

let decoy: string | undefined

/** Empreinte jetable, calculée une fois : elle ne sert qu'à égaliser le délai. */
async function missingAccountHash(): Promise<string> {
  decoy ??= await hashPassword('compte-inexistant')
  return decoy
}
