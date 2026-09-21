import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { regeneratePlan } from '~~/server/application/regenerate-plan'
import { PlanTrigger, SessionStatus } from '~~/server/domain/plan/session'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { fixedClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'
import { FitnessOrigin } from '~~/server/domain/fitness/fitness-point'
import { createPlanGateway, loadActivePlanVersion } from '~~/server/infra/db/plan-gateway'
import * as schema from '~~/server/infra/db/schema'

const url = process.env.NUXT_DATABASE_URL
const db = url ? drizzle(neon(url), { schema }) : null

const TODAY = '2027-01-13'

let athleteId: number

/**
 * La régénération écrit une version, la remplit, puis retire ce que la
 * précédente laissait. Deux exécutions qui s'entrelacent se suppriment leurs
 * séances : ce fichier tient la promesse inverse (§ 5, P8.5).
 */
describe.skipIf(!db)('régénérations concurrentes', () => {
  beforeEach(async () => {
    await truncate()
    athleteId = await seedAthlete()
  })

  it('n’en laisse jamais une vider le plan de l’autre', async () => {
    const gateway = createPlanGateway(db!, athleteId)
    const clock = fixedClock(TODAY)

    await Promise.all([
      regeneratePlan(gateway, clock, PlanTrigger.TestRecorded),
      regeneratePlan(gateway, clock, PlanTrigger.RaceAdded),
      regeneratePlan(gateway, clock, PlanTrigger.Pause),
    ])

    const active = await loadActivePlanVersion(db!, athleteId)
    expect(active?.sessions.length ?? 0).toBeGreaterThan(0)
  })

  it('laisse une seule version porter des séances encore prévues', async () => {
    const gateway = createPlanGateway(db!, athleteId)
    const clock = fixedClock(TODAY)

    await Promise.all([
      regeneratePlan(gateway, clock, PlanTrigger.TestRecorded),
      regeneratePlan(gateway, clock, PlanTrigger.RaceAdded),
    ])

    const active = await loadActivePlanVersion(db!, athleteId)
    const planned = await db!.execute<{ plan_version_id: number; n: number }>(
      sql`select w.plan_version_id, count(*)::int as n
          from session s
          join week w on s.week_id = w.id
          join plan_version pv on w.plan_version_id = pv.id
          where pv.athlete_id = ${athleteId} and s.status = ${SessionStatus.Planned}
          group by 1`,
    )

    expect(planned.rows).toHaveLength(1)
    expect(planned.rows[0]!.plan_version_id).toBe(active!.version.id)
  })

  it('rend le verrou même quand la régénération échoue', async () => {
    const gateway = createPlanGateway(db!, athleteId)
    const broken = { ...gateway, savePlan: () => Promise.reject(new Error('écriture refusée')) }

    await expect(
      regeneratePlan(broken, fixedClock(TODAY), PlanTrigger.TestRecorded),
    ).rejects.toThrow('écriture refusée')

    /** Sans libération, celle-ci attendrait le bail entier puis rendrait 409. */
    await expect(
      regeneratePlan(gateway, fixedClock(TODAY), PlanTrigger.RaceAdded),
    ).resolves.toBeDefined()

    const [row] = await db!
      .select({ lock: schema.athlete.planLockedUntil })
      .from(schema.athlete)
      .where(eq(schema.athlete.id, athleteId))
    expect(row!.lock).toBeNull()
  })
})

async function truncate() {
  const tables = await db!.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  const names = tables.rows
    .map((row) => row.tablename)
    .filter((name) => !name.startsWith('__drizzle'))
  await db!.execute(sql.raw(`truncate table ${names.map((n) => `"${n}"`).join(', ')} cascade`))
}

async function seedAthlete(): Promise<number> {
  const availableDays = [1, 3, 5, 7]
  const [row] = await db!
    .insert(schema.athlete)
    .values({
      firstName: 'Ronan',
      availableDays,
      constraints: { availableDays, longRunDay: 7, sports: [Sport.Running] },
      startWeeklyVolumeM: 25_000,
      peakWeeklyVolumeM: 50_000,
      onboarded: true,
    })
    .returning({ id: schema.athlete.id })
  const id = row!.id

  await db!.insert(schema.fitnessPoint).values({
    athleteId: id,
    date: '2026-12-01',
    vdot: 38,
    origin: FitnessOrigin.Test,
    isFloor: false,
    note: 'Test 20′',
  })

  await db!.insert(schema.race).values({
    athleteId: id,
    name: 'Semi de Paris',
    date: '2027-03-07',
    distanceM: 21097.5,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
    objectifS: 100 * 60,
  })

  return id
}
