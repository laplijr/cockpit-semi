import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const bodySchema = z.object({ password: z.string().min(1) })

function matches(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const { password } = await readValidatedBody(event, bodySchema.parse)
  const { appPassword } = useRuntimeConfig(event)

  if (!appPassword) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_APP_PASSWORD manquant' })
  }

  if (!matches(password, appPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Mot de passe incorrect' })
  }

  await setUserSession(event, { user: { name: 'athlete' }, loggedInAt: Date.now() })
  return { ok: true }
})
