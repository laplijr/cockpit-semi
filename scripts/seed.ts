import { neon } from '@neondatabase/serverless'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import { regeneratePlan } from '../server/application/regenerate-plan'
import { vdotFloorFrom } from '../server/domain/fitness/floor'
import { vdotFromRace } from '../server/domain/fitness/vdot'
import { FitnessOrigin } from '../server/domain/fitness/fitness-point'
import { PauseType } from '../server/domain/pause/pause'
import { PlanTrigger } from '../server/domain/plan/session'
import { ObjectiveMode, RacePriority, RaceStatus, SegmentMode } from '../server/domain/races/race'
import { Sport } from '../server/domain/shared/sport'
import { fixedClock } from '../server/domain/shared/clock'
import { createPlanGateway } from '../server/infra/db/plan-gateway'
import { hashPassword } from './password'
import { resolveScenario } from './scenarios'
import { simulate } from './simulate'
import * as schema from '../server/infra/db/schema'

const url = process.env.NUXT_DATABASE_URL
if (!url) throw new Error('NUXT_DATABASE_URL manquant')

const db = drizzle(neon(url), { schema })

/** Semi du 13 sept. 2026 : 2:26:00 sur 21,5 km, blessure au km 14 (§ 0). */
const REFERENCE_SEGMENTS = [
  { kmDebut: 0, kmFin: 14, mode: SegmentMode.Running, allureSKm: 360, note: 'Continu, 6:00/km' },
  {
    kmDebut: 14,
    kmFin: 19,
    mode: SegmentMode.WalkRun,
    allureSKm: 564,
    note: 'Marche et course alternées après la douleur',
  },
  {
    kmDebut: 19,
    kmFin: 21.5,
    mode: SegmentMode.Running,
    allureSKm: 360,
    note: 'Retour à 6:00/km jusqu’à l’arrivée',
  },
]

/**
 * Vide toutes les tables applicatives. La liste est lue dans le catalogue
 * Postgres plutôt qu'écrite à la main : une table ajoutée au schéma ne peut
 * pas être oubliée ici.
 */
async function reset() {
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  const names = tables.rows
    .map((row) => row.tablename)
    .filter((name) => !name.startsWith('__drizzle'))

  if (names.length === 0) return
  await db.execute(sql.raw(`truncate table ${names.map((n) => `"${n}"`).join(', ')} cascade`))
}

const scenario = resolveScenario(process.argv.slice(2))

/** Une seule dérivation : elle coûte cher et tous les comptes du seed la partagent. */
let seedHash: string | undefined
async function hashSeedPassword(): Promise<string> {
  seedHash ??= await hashPassword(SEED_PASSWORD)
  return seedHash
}

/**
 * Un athlète du seed. L'identifiant n'est plus `1` en dur : il vient de la
 * séquence, et c'est lui qui porte tout ce que le scénario écrit (§ 9, P8.3).
 */
async function createAthlete(values: Omit<schema.NewAthlete, 'id' | 'onboarded'>) {
  const [row] = await db
    .insert(schema.athlete)
    /** Un athlète du seed a déjà son cockpit : le middleware ne le renvoie pas à l'accueil. */
    .values({ ...values, onboarded: true })
    .returning({ id: schema.athlete.id })
  return row!.id
}

/**
 * Mot de passe des comptes du seed. C'est une base de développement, rejouée
 * à chaque `pnpm db:seed` : le secret n'a rien à protéger, et il vaut mieux
 * qu'il soit écrit là que deviné (§ 9, P8.4).
 */
const SEED_PASSWORD = 'cockpit-dev-2026'

async function createAccount(login: string, athleteId: number) {
  await db.insert(schema.user).values({ login, passwordHash: await hashSeedPassword(), athleteId })
  return login
}

async function seed() {
  await reset()

  if (scenario.empty) {
    console.log(`Scénario « ${scenario.name} » — ${scenario.description}`)
    console.log('')
    console.log(`export NUXT_COCKPIT_TODAY=${scenario.simulatedDay}`)
    return
  }

  const athleteId = await createAthlete({
    firstName: 'Ronan',
    constraints: { availableDays: [1, 2, 3, 4, 5, 6, 7], longRunDay: 7, easyDays: [1] },
    availableDays: [1, 2, 3, 4, 5, 6, 7],
    startWeeklyVolumeM: 20_000,
    peakWeeklyVolumeM: 45_000,
  })

  /**
   * Le 10 km du printemps, couru proprement : c'est le seul chrono
   * représentatif de l'historique, donc le seul record de la table. Il précède
   * la blessure et ne touche pas au plan — la périodisation ne lit que les
   * courses encore planifiées.
   */
  const [tenK] = await db
    .insert(schema.race)
    .values({
      athleteId,
      name: '10 km de Vannes',
      date: '2026-06-21',
      distanceM: 10_000,
      priority: RacePriority.C,
      objectiveMode: ObjectiveMode.Time,
      status: RaceStatus.Raced,
      resultatS: 56 * 60 + 40,
      representative: true,
      notes: 'Couru à fond, sans incident : la référence sur 10 km.',
    })
    .returning()

  await db.insert(schema.fitnessPoint).values({
    athleteId,
    date: '2026-06-21',
    vdot: vdotFromRace(10_000, 56 * 60 + 40),
    origin: FitnessOrigin.Race,
    raceId: tenK!.id,
    isFloor: false,
    note: 'Chrono représentatif sur 10 km',
  })

  const [reference] = await db
    .insert(schema.race)
    .values({
      athleteId,
      name: 'Premier semi-marathon',
      date: '2026-09-13',
      distanceM: 21500,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
      status: RaceStatus.Raced,
      resultatS: 2 * 3600 + 26 * 60,
      representative: false,
      incident: { km: 14, type: 'blessure', note: 'Douleur au creux poplité, genou droit' },
      notes: 'Chrono non représentatif : le segment 0–14 km sert de plancher.',
    })
    .returning()

  await db
    .insert(schema.raceSegment)
    .values(REFERENCE_SEGMENTS.map((segment) => ({ ...segment, raceId: reference!.id })))

  const floor = vdotFloorFrom(REFERENCE_SEGMENTS)
  if (!floor) throw new Error('Aucun segment continu exploitable dans la course de référence')

  await db.insert(schema.fitnessPoint).values({
    athleteId,
    date: '2026-09-13',
    vdot: floor.vdot,
    origin: FitnessOrigin.Race,
    raceId: reference!.id,
    isFloor: true,
    note: `Plancher déduit du segment ${floor.segment.kmDebut}–${floor.segment.kmFin} km`,
  })

  await db.insert(schema.race).values([
    {
      athleteId,
      name: 'Semi de Paris',
      date: '2027-03-07',
      distanceM: 21097.5,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
      objectifS: null,
      notes:
        'Se tester : couru à fond pour recaler le VDOT avant Madrid. Les trois niveaux se posent au premier test.',
    },
    {
      athleteId,
      name: 'Semi de Madrid',
      date: '2027-04-04',
      distanceM: 21097.5,
      priority: RacePriority.B,
      objectiveMode: ObjectiveMode.Time,
      objectifS: null,
      notes: 'Courue sur la forme de Paris, recalée par le test.',
    },
    {
      athleteId,
      name: '5 km · Île d’Arz',
      date: '2027-08-08',
      distanceM: 5000,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
      objectifS: null,
      notes: 'Première course sur 5 km : les trois niveaux se posent depuis la projection.',
    },
    {
      athleteId,
      name: 'Semi-marathon Auray-Vannes',
      date: '2027-09-12',
      distanceM: 21097.5,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.Time,
      objectifS: 1 * 3600 + 50 * 60,
      notes: 'Course principale de la saison.',
    },
  ])

  await db.insert(schema.pause).values({
    athleteId,
    type: PauseType.Injury,
    zone: 'pied',
    startDate: '2026-09-16',
    estimatedEndDate: null,
    endDate: null,
    allowances: {
      running: false,
      cycling: true,
      upperBodyStrength: true,
      legStrength: true,
      conditions: ['Vélo et muscu jambes seulement si la chaussure ne fait pas mal'],
    },
    watchZones: ['genou droit, face postérieure'],
    notes: 'Ongle de pied cassé. Reprise quand la douleur en marchant est nulle.',
  })

  await createAccount('ronan', athleteId)

  const clock = fixedClock(scenario.resumeDate ?? scenario.simulatedDay)
  const { planVersionId, plan } = await regeneratePlan(
    createPlanGateway(db, athleteId),
    clock,
    PlanTrigger.Onboarding,
  )

  console.log(`Scénario « ${scenario.name} » — ${scenario.description}`)
  console.log(
    `Plan ${planVersionId} — départ ${plan.startDate ?? 'non daté'}, ${plan.phases.length} phases, ${plan.weeks.length} semaines, plancher VDOT ${floor.vdot.toFixed(2)}`,
  )

  const progress = await simulate(db, athleteId, scenario)
  if (scenario.resumeDate) {
    console.log(
      `Rejeu du ${scenario.resumeDate} au ${scenario.simulatedDay} : ${progress.sessionsDone} séances faites, ${progress.sessionsMissed} manquées, ${progress.tests} test(s), ${progress.strengthSets} séries de renforcement, ${progress.decisions} décisions, ${progress.habits} habitude(s), ${progress.objectivesSet} objectif(s) posé(s), VDOT ${progress.lastVdot.toFixed(2)}`,
    )
  }

  if (scenario.second) await seedSecondAthlete()

  console.log('')
  console.log(`Comptes du seed : mot de passe « ${SEED_PASSWORD} ».`)
  console.log(`export NUXT_COCKPIT_TODAY=${scenario.simulatedDay}`)
}

/**
 * Une seconde personne sur la même base. Elle n'a rien de commun avec Ronan —
 * d'autres jours, d'autres courses, un autre niveau — pour que le moindre
 * mélange se voie du premier coup d'œil (§ 9, P8.3).
 */
async function seedSecondAthlete() {
  const athleteId = await createAthlete({
    firstName: 'Nour',
    constraints: { availableDays: [2, 4, 6], longRunDay: 6, sports: [Sport.Running] },
    availableDays: [2, 4, 6],
    startWeeklyVolumeM: 30_000,
    peakWeeklyVolumeM: 60_000,
  })

  await db.insert(schema.fitnessPoint).values({
    athleteId,
    date: '2026-09-01',
    vdot: vdotFromRace(10_000, 47 * 60),
    origin: FitnessOrigin.InitialImport,
    isFloor: false,
    note: 'Chrono déclaré · 10 000 m',
  })

  await db.insert(schema.race).values({
    athleteId,
    name: 'Marathon de Nantes',
    date: '2027-04-25',
    distanceM: 42195,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
    objectifS: 3 * 3600 + 30 * 60,
    notes: 'Course de Nour : elle ne doit jamais apparaître dans le cockpit de Ronan.',
  })

  const { plan } = await regeneratePlan(
    createPlanGateway(db, athleteId),
    fixedClock(scenario.simulatedDay),
    PlanTrigger.Onboarding,
  )

  await createAccount('nour', athleteId)

  console.log(
    `Second athlète ${athleteId} — Nour, ${plan.weeks.length} semaines jusqu'au marathon de Nantes.`,
  )
}

await seed()
