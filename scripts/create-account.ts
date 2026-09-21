import { neon } from '@neondatabase/serverless'
import { asc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { loginRefusal, passwordRefusal } from '../server/domain/account/account'
import * as schema from '../server/infra/db/schema'
import { hashPassword, verifyPassword } from './password'

/**
 * Premier compte d'une base. Il se rattache à l'athlète le plus ancien plutôt
 * que d'en créer un : le cockpit de Ronan est migré, pas recréé (§ 9, P8.4).
 *
 *   COCKPIT_LOGIN=ronan COCKPIT_PASSWORD='…' pnpm account:create
 *
 * Le mot de passe passe par l'environnement et non par un argument : il ne
 * reste pas dans l'historique du shell.
 */
const url = process.env.NUXT_DATABASE_URL
if (!url) throw new Error('NUXT_DATABASE_URL manquant')

const login = (process.env.COCKPIT_LOGIN ?? '').trim().toLowerCase()
const password = process.env.COCKPIT_PASSWORD ?? ''

const refusal = loginRefusal(login) ?? passwordRefusal(password)
if (refusal) throw new Error(refusal)

const db = drizzle(neon(url), { schema })

const [taken] = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(eq(schema.user.login, login))
  .limit(1)
if (taken) throw new Error(`L'identifiant « ${login} » est déjà pris.`)

const [existing] = await db
  .select({ id: schema.athlete.id })
  .from(schema.athlete)
  .orderBy(asc(schema.athlete.id))
  .limit(1)

const athleteId =
  existing?.id ??
  (
    await db
      .insert(schema.athlete)
      .values({ onboarded: false })
      .returning({ id: schema.athlete.id })
  )[0]!.id

const [created] = await db
  .insert(schema.user)
  .values({ login, passwordHash: await hashPassword(password), athleteId })
  .returning({ id: schema.user.id, passwordHash: schema.user.passwordHash })

/** Relecture immédiate : une empreinte qu'on ne sait pas relire ne sert à rien. */
if (!(await verifyPassword(created!.passwordHash, password))) {
  throw new Error('Empreinte illisible : le compte n’a pas été créé correctement.')
}

console.log(
  `Compte « ${login} » créé (id ${created!.id}), rattaché à l'athlète ${athleteId}${
    existing ? ' déjà en base' : ' créé pour l’occasion'
  }.`,
)
