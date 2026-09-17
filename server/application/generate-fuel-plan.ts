import { eq, and, isNull } from 'drizzle-orm'
import { buildFuelPlan, type FuelPlan } from '../domain/nutrition/fuel-plan'
import { PROTOCOL_DAYS } from '../domain/nutrition/race-week'
import { addDays, type IsoDate } from '../domain/plan/calendar'
import { RaceStatus } from '../domain/races/race'
import type { Database } from '../infra/db/client'
import { race } from '../infra/db/schema'
import { loadProjectionContext, projectRace } from '../utils/race-projection'

/**
 * Le plan ravito se calcule sur la durée **projetée**, pas sur l'objectif : ce
 * qu'on tiendra le jour J décide de ce qu'on emporte (§ 5). Sans projection —
 * aucun point de forme — il n'y a rien à calculer.
 */
export async function generateFuelPlan(
  db: Database,
  raceId: number,
  today: IsoDate,
): Promise<FuelPlan | null> {
  const [row] = await db.select().from(race).where(eq(race.id, raceId)).limit(1)
  if (!row) return null

  const context = await loadProjectionContext(db)
  const projection = projectRace(context, row)
  if (!projection) return null

  const plan = buildFuelPlan({
    durationS: projection.timeS,
    distanceM: row.distanceM,
    tempC: row.expectedTempC,
    generatedAt: today,
  })

  await db.update(race).set({ fuelPlan: plan }).where(eq(race.id, raceId))
  return plan
}

/**
 * À J−7, chaque course encore planifiée reçoit son plan. Une course dont le
 * plan existe déjà n'est pas retouchée ici : il se régénère à la demande, ou
 * quand la météo attendue change.
 */
export async function generateDueFuelPlans(db: Database, today: IsoDate): Promise<number> {
  const horizon = addDays(today, PROTOCOL_DAYS)

  const due = await db
    .select({ id: race.id, date: race.date })
    .from(race)
    .where(and(eq(race.status, RaceStatus.Planned), isNull(race.fuelPlan)))

  const ids = due.filter((row) => row.date >= today && row.date <= horizon).map((row) => row.id)
  const plans = await Promise.all(ids.map((id) => generateFuelPlan(db, id, today)))

  return plans.filter(Boolean).length
}
