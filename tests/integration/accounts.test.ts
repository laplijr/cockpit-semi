import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { newInvitationToken } from '~~/server/application/accounts'
import {
  INVITATION_DAYS,
  invitationExpiry,
  invitationRefusal,
  loginRefusal,
  passwordRefusal,
} from '~~/server/domain/account/account'
import * as schema from '~~/server/infra/db/schema'

const url = process.env.NUXT_DATABASE_URL
const db = url ? drizzle(neon(url), { schema }) : null
const hasher = new Hash(new Scrypt({}))

let athleteId: number

describe.skipIf(!db)('comptes et invitations (§ 9, P8.4)', () => {
  beforeAll(async () => {
    const database = db!
    const tables = await database.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    )
    const names = tables.rows
      .map((row) => row.tablename)
      .filter((name) => !name.startsWith('__drizzle'))
    await database.execute(
      sql.raw(`truncate table ${names.map((n) => `"${n}"`).join(', ')} cascade`),
    )

    const [row] = await database
      .insert(schema.athlete)
      .values({ firstName: 'Alice', onboarded: true })
      .returning({ id: schema.athlete.id })
    athleteId = row!.id
  })

  it('range une empreinte relisible, et jamais le mot de passe', async () => {
    const [account] = await db!
      .insert(schema.user)
      .values({
        login: 'alice',
        passwordHash: await hasher.make('un-mot-de-passe-long'),
        athleteId,
      })
      .returning()

    expect(account!.passwordHash).not.toContain('un-mot-de-passe-long')
    /** Un coût paramétrable laisse sa trace dans l'empreinte ; `sha256` n'en a pas. */
    expect(account!.passwordHash).toMatch(/^\$scrypt\$/)
    await expect(hasher.verify(account!.passwordHash, 'un-mot-de-passe-long')).resolves.toBe(true)
    await expect(hasher.verify(account!.passwordHash, 'autre-chose')).resolves.toBe(false)
  })

  it('emporte le compte avec l’athlète quand il part', async () => {
    const [other] = await db!
      .insert(schema.athlete)
      .values({ firstName: 'Bob' })
      .returning({ id: schema.athlete.id })

    await db!.insert(schema.user).values({
      login: 'bob',
      passwordHash: await hasher.make('encore-un-mot-de-passe'),
      athleteId: other!.id,
    })

    await db!.delete(schema.athlete).where(eq(schema.athlete.id, other!.id))

    const logins = (await db!.select({ login: schema.user.login }).from(schema.user)).map(
      (row) => row.login,
    )
    expect(logins).toEqual(['alice'])
  })

  it('garde l’invitation consommée même quand son compte disparaît', async () => {
    const [account] = await db!.select().from(schema.user).limit(1)
    const [ticket] = await db!
      .insert(schema.invitation)
      .values({
        token: newInvitationToken(),
        label: 'Camille',
        expiresAt: invitationExpiry(new Date()),
        consumedBy: account!.id,
        consumedAt: new Date(),
      })
      .returning()

    expect(ticket!.token).toHaveLength(43)
    expect(ticket!.expiresAt.getTime() - ticket!.createdAt.getTime()).toBeGreaterThan(
      (INVITATION_DAYS - 1) * 86_400_000,
    )
  })

  it('compte les appels externes par athlète, par jour et par nature', async () => {
    await db!.insert(schema.apiUsage).values([
      { athleteId, date: '2026-11-22', kind: schema.ExternalCall.Unplanned, calls: 3 },
      { athleteId, date: '2026-11-22', kind: schema.ExternalCall.RaceLookup, calls: 1 },
      { athleteId, date: '2026-11-23', kind: schema.ExternalCall.Unplanned, calls: 2 },
    ])

    const rows = await db!
      .select()
      .from(schema.apiUsage)
      .where(eq(schema.apiUsage.date, '2026-11-22'))
    expect(rows).toHaveLength(2)
  })
})

describe('règles de compte, sans base', () => {
  it('refuse un identifiant trop court ou exotique', () => {
    expect(loginRefusal('ab')).toBeDefined()
    expect(loginRefusal('Ronan')).toBeDefined()
    expect(loginRefusal('-ronan')).toBeDefined()
    expect(loginRefusal('ronan')).toBeUndefined()
    expect(loginRefusal('ronan.l_2')).toBeUndefined()
  })

  it('refuse un mot de passe trop court', () => {
    expect(passwordRefusal('court')).toBeDefined()
    expect(passwordRefusal('assez-long-lui')).toBeUndefined()
  })

  it('refuse une invitation absente, consommée ou expirée', () => {
    const now = new Date('2026-11-22T12:00:00Z')
    const later = new Date('2026-12-01T12:00:00Z')
    const earlier = new Date('2026-11-01T12:00:00Z')

    expect(invitationRefusal(undefined, now)).toMatch(/n’existe pas/)
    expect(invitationRefusal({ expiresAt: later, consumedAt: now }, now)).toMatch(/déjà servi/)
    expect(invitationRefusal({ expiresAt: earlier, consumedAt: null }, now)).toMatch(/expiré/)
    expect(invitationRefusal({ expiresAt: later, consumedAt: null }, now)).toBeUndefined()
  })

  it('tire un jeton différent à chaque fois', () => {
    const tokens = new Set(Array.from({ length: 50 }, newInvitationToken))
    expect(tokens.size).toBe(50)
  })
})
