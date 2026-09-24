import { desc, eq } from 'drizzle-orm'
import { currentFitnessOf, fitnessVerdict } from '../domain/fitness/current'
import { useDatabase } from '../infra/db/client'
import { fitnessPoint } from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

/**
 * Le point de forme courant, tel que Profil l'affiche : sa valeur, sa nature
 * et sa date. Nul quand il n'y en a aucun — l'absence devient visible au lieu
 * d'être déductible (§ 9, P7.5).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)

  const rows = await useDatabase()
    .select()
    .from(fitnessPoint)
    .where(eq(fitnessPoint.athleteId, athleteId))
    .orderBy(desc(fitnessPoint.date), desc(fitnessPoint.id))

  /** Le même point que celui sur lequel le moteur travaille, règle comprise. */
  const current = currentFitnessOf(rows, systemClock.today())
  if (!current) return { point: null }

  const row = rows.find((item) => item.date === current.date && item.vdot === current.vdot)
  return {
    point: {
      vdot: current.vdot,
      isFloor: current.isFloor,
      origin: row?.origin ?? null,
      date: current.date,
      note: row?.note ?? null,
      verdict: fitnessVerdict(rows, current),
    },
  }
})
