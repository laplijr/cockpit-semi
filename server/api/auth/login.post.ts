import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { lockMessage, lockedMinutes, windowCutoff } from '../../domain/account/throttle'
import { useDatabase } from '../../infra/db/client'
import { loginAttempt, user } from '../../infra/db/schema'

const bodySchema = z.object({ login: z.string().min(1).max(60), password: z.string().min(1) })

/**
 * Un seul message d'erreur, quelle que soit la cause : dire lequel des deux
 * est faux dirait qui a un compte ici (§ 9, P8.4).
 */
const REFUSAL = 'Identifiant ou mot de passe incorrect'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const login = body.login.trim().toLowerCase()
  const now = new Date()

  const attempt = await countAttempt(login, now)
  const wait = lockedMinutes(attempt, now)
  if (wait !== null) throw createError({ statusCode: 429, statusMessage: lockMessage(wait) })

  const [row] = await db.select().from(user).where(eq(user.login, login)).limit(1)

  /**
   * Sans compte, on vérifie quand même un mot de passe : sinon la réponse
   * arrive plus vite, et le délai dit à lui seul que l'identifiant n'existe pas.
   */
  const hash = row?.passwordHash ?? (await missingAccountHash())
  const ok = await verifyPassword(hash, body.password)

  if (!row || !ok) throw createError({ statusCode: 401, statusMessage: REFUSAL })

  await db.delete(loginAttempt).where(eq(loginAttempt.login, login))
  await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, row.id))
  await setUserSession(event, {
    user: { id: row.id, login: row.login, athleteId: row.athleteId },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})

/**
 * Compte la tentative en une seule écriture, avant de la juger (P28) : la
 * fenêtre échue repart à un, sinon le compteur monte. Lire puis écrire
 * laisserait des essais parallèles passer tous sous la limite.
 */
async function countAttempt(login: string, now: Date) {
  const expired = sql`${loginAttempt.windowStart} <= ${windowCutoff(now).toISOString()}`
  const [attempt] = await useDatabase()
    .insert(loginAttempt)
    .values({ login, failures: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempt.login,
      set: {
        failures: sql`case when ${expired} then 1 else ${loginAttempt.failures} + 1 end`,
        windowStart: sql`case when ${expired} then ${now.toISOString()}::timestamptz else ${loginAttempt.windowStart} end`,
      },
    })
    .returning()
  return attempt!
}

let decoy: string | undefined

/** Empreinte jetable, calculée une fois : elle ne sert qu'à égaliser le délai. */
async function missingAccountHash(): Promise<string> {
  decoy ??= await hashPassword('compte-inexistant')
  return decoy
}
