import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { regeneratePlan } from '../server/application/regenerate-plan'
import { vdotFloorFrom } from '../server/domain/fitness/floor'
import { FitnessOrigin } from '../server/domain/fitness/fitness-point'
import { PauseType } from '../server/domain/pause/pause'
import { PlanTrigger } from '../server/domain/plan/session'
import { ObjectiveMode, RacePriority, RaceStatus, SegmentMode } from '../server/domain/races/race'
import { createPlanGateway } from '../server/infra/db/plan-gateway'
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

async function reset() {
  await db.delete(schema.session)
  await db.delete(schema.week)
  await db.delete(schema.phase)
  await db.delete(schema.planVersion)
  await db.delete(schema.fitnessPoint)
  await db.delete(schema.raceSegment)
  await db.delete(schema.race)
  await db.delete(schema.pause)
  await db.delete(schema.athlete)
}

async function seed() {
  await reset()

  await db.insert(schema.athlete).values({
    id: 1,
    constraints: { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] },
    availableDays: [1, 2, 3, 5, 6, 7],
    onboarded: false,
  })

  const [reference] = await db
    .insert(schema.race)
    .values({
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
    date: '2026-09-13',
    vdot: floor.vdot,
    origin: FitnessOrigin.Race,
    raceId: reference!.id,
    isFloor: true,
    note: `Plancher déduit du segment ${floor.segment.kmDebut}–${floor.segment.kmFin} km`,
  })

  await db.insert(schema.race).values([
    {
      name: 'Semi de Paris',
      date: '2027-03-07',
      distanceM: 21097.5,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.MaxPerformance,
      objectifS: null,
      notes: 'Se tester : couru à fond pour recaler le VDOT avant Madrid.',
    },
    {
      name: 'Semi de Madrid',
      date: '2027-04-04',
      distanceM: 21097.5,
      priority: RacePriority.B,
      objectiveMode: ObjectiveMode.MaxPerformance,
      objectifS: null,
      notes: 'Performance maximale, sur la forme de Paris recalée par le test.',
    },
    {
      name: '5 km · Île d’Arz',
      date: '2027-08-08',
      distanceM: 5000,
      priority: RacePriority.A,
      objectiveMode: ObjectiveMode.MaxPerformance,
      objectifS: null,
      notes: 'Performance maximale : l’objectif est la projection du jour, à battre.',
    },
  ])

  await db.insert(schema.pause).values({
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

  const { planVersionId, plan } = await regeneratePlan(
    createPlanGateway(db),
    { today: () => new Date().toISOString().slice(0, 10) },
    PlanTrigger.Onboarding,
  )

  console.log(
    `Plan ${planVersionId} — départ ${plan.startDate}${plan.provisional ? ' (provisoire, pause ouverte)' : ''}`,
  )
  console.log(
    `${plan.phases.length} phases, ${plan.weeks.length} semaines, plancher VDOT ${floor.vdot.toFixed(2)}`,
  )
}

await seed()
