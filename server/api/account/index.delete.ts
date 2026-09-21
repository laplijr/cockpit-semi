import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { athlete } from '../../infra/db/schema'
import { currentAthleteId } from '../../utils/context'
import { currentUser, currentUserId, isOwner } from '../../utils/owner'

const bodySchema = z.object({ login: z.string().min(1) })

/**
 * Efface l'athlète, et tout ce qui pend dessous part en cascade : courses,
 * plans, séances, ressentis, charge, propositions, habitudes, compte. Une
 * personne qui teste doit pouvoir partir (§ 11, P8.4).
 */
export default defineEventHandler(async (event) => {
  const userId = await currentUserId(event)
  const account = await currentUser(userId)

  /** La confirmation est l'identifiant retapé : un « oui » se clique trop vite. */
  const { login } = await readValidatedBody(event, bodySchema.parse)
  if (!account || login.trim().toLowerCase() !== account.login) {
    throw createError({ statusCode: 400, statusMessage: 'Retape ton identifiant pour confirmer.' })
  }

  /** Le compte principal ne se supprime pas depuis l'écran : il est la porte. */
  if (await isOwner(userId)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Le compte principal ne se supprime pas depuis ici.',
    })
  }

  const athleteId = await currentAthleteId(event)
  await useDatabase().delete(athlete).where(eq(athlete.id, athleteId))
  await clearUserSession(event)

  return { ok: true }
})
