import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { invitationRefusal, loginRefusal, passwordRefusal } from '../../application/accounts'
import { useDatabase } from '../../infra/db/client'
import { athlete, invitation, user } from '../../infra/db/schema'

const bodySchema = z.object({
  token: z.string().min(10).max(120),
  login: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
})

/**
 * Création d'un compte depuis une invitation. C'est la seule porte d'entrée :
 * aucune inscription libre, aucun e-mail (§ 9, P8.4).
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const login = body.login.trim().toLowerCase()
  const refusal = loginRefusal(login) ?? passwordRefusal(body.password)
  if (refusal) throw createError({ statusCode: 400, statusMessage: refusal })

  const [ticket] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.token, body.token))
    .limit(1)

  const invalid = invitationRefusal(ticket, new Date())
  if (invalid) throw createError({ statusCode: 410, statusMessage: invalid })

  const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.login, login)).limit(1)
  if (taken) throw createError({ statusCode: 409, statusMessage: 'Cet identifiant est déjà pris.' })

  const [created] = await db.insert(athlete).values({ onboarded: false }).returning({
    id: athlete.id,
  })

  const [account] = await db
    .insert(user)
    .values({
      login,
      passwordHash: await hashPassword(body.password),
      athleteId: created!.id,
      lastLoginAt: new Date(),
    })
    .returning()

  await db
    .update(invitation)
    .set({ consumedBy: account!.id, consumedAt: new Date() })
    .where(eq(invitation.id, ticket!.id))

  await setUserSession(event, {
    user: { id: account!.id, login, athleteId: created!.id },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
