import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { detectAndStoreHabits } from '~~/server/application/detect-habits'
import { generateDueFuelPlans } from '~~/server/application/generate-fuel-plan'
import { regeneratePlan } from '~~/server/application/regenerate-plan'
import { PlanTrigger, SessionStatus } from '~~/server/domain/plan/session'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { fixedClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'
import { createFitnessGateway, createPauseGateway } from '~~/server/infra/db/feedback-gateway'
import { FitnessOrigin } from '~~/server/domain/fitness/fitness-point'
import { PauseType } from '~~/server/domain/pause/pause'
import { publishSession, weekOf } from '~~/server/domain/circle/post'
import {
  circleMembers,
  insertComment,
  insertPost,
  isMember,
  postsOfWeek,
  setMembership,
  toggleBravo,
} from '~~/server/infra/db/circle-gateway'
import {
  athleteWeekIds,
  createPlanGateway,
  loadActivePlanVersion,
} from '~~/server/infra/db/plan-gateway'
import { recomputeLoadFor } from '~~/server/infra/db/load-repository'
import { listProposals } from '~~/server/infra/db/proposal-repository'
import { readMealPlan } from '~~/server/infra/db/meal-plan-gateway'
import { loadProjectionContext } from '~~/server/utils/race-projection'
import { currentReadiness } from '~~/server/utils/readiness-context'
import * as schema from '~~/server/infra/db/schema'

const url = process.env.NUXT_DATABASE_URL
const db = url ? drizzle(neon(url), { schema }) : null

const TODAY = '2027-01-11'

interface Pair {
  alice: number
  bob: number
}

let ids: Pair

/**
 * Deux athlètes, la même base, les mêmes cas d'usage. Ce test ne vérifie pas
 * une requête mais la promesse : ce que rend le cockpit de l'un ne contient
 * rien de l'autre (§ 11, P8.3).
 */
describe.skipIf(!db)('deux athlètes sur la même base', () => {
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

    ids = { alice: await seedAlice(), bob: await seedBob() }
  })

  it('donne à chacun son plan, et rien du plan de l’autre', async () => {
    const alice = await loadActivePlanVersion(db!, ids.alice)
    const bob = await loadActivePlanVersion(db!, ids.bob)

    expect(alice).toBeDefined()
    expect(bob).toBeDefined()
    expect(alice!.version.id).not.toBe(bob!.version.id)
    expect(alice!.weeks.length).toBeGreaterThan(0)
    expect(bob!.weeks.length).toBeGreaterThan(0)

    const aliceWeeks = new Set(alice!.weeks.map((week) => week.id))
    expect(bob!.weeks.some((week) => aliceWeeks.has(week.id))).toBe(false)

    const aliceSessions = new Set(alice!.sessions.map((item) => item.id))
    expect(bob!.sessions.some((item) => aliceSessions.has(item.id))).toBe(false)
  })

  it('ne montre à chacun que ses courses', async () => {
    const forAlice = await createPlanGateway(db!, ids.alice).loadRaces()
    const forBob = await createPlanGateway(db!, ids.bob).loadRaces()

    expect(forAlice.map((race) => race.name)).toEqual(['Semi d’Alice'])
    expect(forBob.map((race) => race.name)).toEqual(['Marathon de Bob'])
  })

  it('ne montre à chacun que son point de forme', async () => {
    const alice = await createPlanGateway(db!, ids.alice).loadCurrentFitness()
    const bob = await createPlanGateway(db!, ids.bob).loadCurrentFitness()

    expect(Math.round(alice!.vdot)).toBe(35)
    expect(Math.round(bob!.vdot)).toBe(50)
  })

  it('ne montre à chacun que sa pause', async () => {
    const alice = await createPlanGateway(db!, ids.alice).loadLatestPause()
    const bob = await createPlanGateway(db!, ids.bob).loadLatestPause()

    expect(alice?.zone).toBe('mollet gauche')
    expect(bob).toBeUndefined()
  })

  it('tient une charge quotidienne par athlète, pas une par jour', async () => {
    const alice = await recomputeLoadFor(db!, ids.alice, TODAY)
    const bob = await recomputeLoadFor(db!, ids.bob, TODAY)

    expect(alice.date).toBe(TODAY)
    expect(bob.date).toBe(TODAY)

    const rows = await db!.select().from(schema.loadDaily).where(eq(schema.loadDaily.date, TODAY))
    expect(rows).toHaveLength(2)
  })

  it('calcule la forme du jour de chacun sans lire les séances de l’autre', async () => {
    await expect(currentReadiness(db!, ids.alice, TODAY)).resolves.toMatchObject({
      score: expect.any(Number),
    })
    await expect(currentReadiness(db!, ids.bob, TODAY)).resolves.toMatchObject({
      score: expect.any(Number),
    })
  })

  it('ne rend à chacun que ses propositions, ses habitudes et ses repas', async () => {
    expect(await listProposals(db!, ids.alice)).toEqual([])
    expect(await listProposals(db!, ids.bob)).toEqual([])

    await detectAndStoreHabits(db!, ids.alice, TODAY)
    const habits = await db!.select().from(schema.habit)
    expect(habits.every((row) => row.athleteId === ids.alice)).toBe(true)

    expect(await readMealPlan(db!, ids.bob, TODAY)).toBeUndefined()
  })

  it('ne projette pour chacun que depuis sa propre forme', async () => {
    const alice = await loadProjectionContext(db!, ids.alice)
    const bob = await loadProjectionContext(db!, ids.bob)

    expect(Math.round(alice.fitness!.vdot)).toBe(35)
    expect(Math.round(bob.fitness!.vdot)).toBe(50)
  })

  it('ne génère les plans ravito que pour les courses de l’athlète visé', async () => {
    /** La course d'Alice est à J−7 du jour simulé, celle de Bob non. */
    expect(await generateDueFuelPlans(db!, ids.bob, TODAY)).toBe(0)
    expect(await generateDueFuelPlans(db!, ids.alice, TODAY)).toBe(1)

    const withPlan = await db!
      .select({ athleteId: schema.race.athleteId })
      .from(schema.race)
      .where(sql`${schema.race.fuelPlan} is not null`)
    expect(withPlan.map((row) => row.athleteId)).toEqual([ids.alice])
  })

  /**
   * Le cercle est la seule chose que les deux voient ensemble (P9). Ce qui se
   * vérifie ici n'est pas une requête mais la frontière : la publication
   * traverse, la séance dont elle est née ne traverse pas.
   */
  it('montre à chacun la publication de l’autre, et jamais sa séance', async () => {
    const week = weekOf(TODAY)
    const [session] = await db!
      .select()
      .from(schema.session)
      .where(inArray(schema.session.weekId, athleteWeekIds(db!, ids.bob)))
      .limit(1)

    const outcome = publishSession(
      {
        id: session!.id,
        sport: session!.sport,
        code: session!.code,
        date: week.from,
        status: SessionStatus.Done,
        actualDistanceM: 12_000,
        actualDurationMin: 68,
        plannedDistanceM: null,
        plannedDurationMin: null,
      },
      'Douze bornes au frais.',
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    await insertPost(db!, ids.bob, outcome.post)

    const seen = await postsOfWeek(db!, ids.alice, week)
    expect(seen).toHaveLength(1)
    expect(seen[0]!.note).toBe('Douze bornes au frais.')
    expect(seen[0]!.athleteId).toBe(ids.bob)

    /** La séance d'origine, elle, reste de l'autre côté du mur. */
    const hers = await loadActivePlanVersion(db!, ids.alice)
    expect(hers!.sessions.some((one) => one.id === session!.id)).toBe(false)
  })

  it('ferme la lecture à qui quitte le cercle, sans rien détruire', async () => {
    await setMembership(db!, ids.alice, false)
    expect(await isMember(db!, ids.alice)).toBe(false)
    expect((await circleMembers(db!)).map((one) => one.id)).toEqual([ids.bob])

    /** Ce qu'elle avait lu existe toujours : quitter ferme, il n'efface pas. */
    expect(await postsOfWeek(db!, ids.bob, weekOf(TODAY))).toHaveLength(1)

    await setMembership(db!, ids.alice, true)
  })

  it('emporte les publications, les bravos et les commentaires d’un compte supprimé', async () => {
    const [published] = await db!.select({ id: schema.post.id }).from(schema.post)
    await toggleBravo(db!, ids.alice, published!.id)
    await insertComment(db!, ids.alice, published!.id, 'Belle sortie.')

    await db!.delete(schema.athlete).where(eq(schema.athlete.id, ids.bob))

    expect(await db!.select().from(schema.post)).toEqual([])
    expect(await db!.select().from(schema.postReaction)).toEqual([])
    expect(await db!.select().from(schema.postComment)).toEqual([])
  })

  it('efface tout ce qui est à lui, et rien d’autre, quand un athlète part', async () => {
    await db!.delete(schema.athlete).where(eq(schema.athlete.id, ids.bob))

    const races = await db!.select({ athleteId: schema.race.athleteId }).from(schema.race)
    expect(races.every((row) => row.athleteId === ids.alice)).toBe(true)

    expect(await loadActivePlanVersion(db!, ids.alice)).toBeDefined()
  })
})

async function seedAlice(): Promise<number> {
  const id = await createAthlete('Alice', [1, 3, 5, 7])

  await db!.insert(schema.fitnessPoint).values({
    athleteId: id,
    date: '2026-12-01',
    vdot: 35,
    origin: FitnessOrigin.Declared,
    isFloor: true,
    note: 'Allure déclarée',
  })

  await db!.insert(schema.race).values({
    athleteId: id,
    name: 'Semi d’Alice',
    date: '2027-01-17',
    distanceM: 21097.5,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
    objectifS: 2 * 3600,
  })

  await db!.insert(schema.pause).values({
    athleteId: id,
    type: PauseType.Injury,
    zone: 'mollet gauche',
    startDate: '2026-12-20',
    endDate: '2026-12-28',
    allowances: { running: false, cycling: true, upperBodyStrength: true, legStrength: false },
  })

  await regeneratePlan(createPlanGateway(db!, id), fixedClock(TODAY), PlanTrigger.Onboarding)
  return id
}

async function seedBob(): Promise<number> {
  const id = await createAthlete('Bob', [2, 4, 6])

  await createFitnessGateway(db!, id).saveFitnessPoint({
    date: '2026-12-05',
    vdot: 50,
    origin: FitnessOrigin.Test,
    isFloor: false,
    note: 'Test 20′',
  })

  await db!.insert(schema.race).values({
    athleteId: id,
    name: 'Marathon de Bob',
    date: '2027-06-06',
    distanceM: 42195,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
    objectifS: 3 * 3600,
  })

  /** La passerelle de pause de Bob ne doit pas fermer celle d'Alice. */
  await createPauseGateway(db!, id).closeOpenPauses(TODAY)

  await regeneratePlan(createPlanGateway(db!, id), fixedClock(TODAY), PlanTrigger.Onboarding)
  return id
}

async function createAthlete(firstName: string, availableDays: number[]): Promise<number> {
  const [row] = await db!
    .insert(schema.athlete)
    .values({
      firstName,
      availableDays,
      constraints: { availableDays, longRunDay: availableDays.at(-1)!, sports: [Sport.Running] },
      startWeeklyVolumeM: 20_000,
      peakWeeklyVolumeM: 45_000,
      onboarded: true,
    })
    .returning({ id: schema.athlete.id })
  return row!.id
}
