import { desc, eq } from 'drizzle-orm'
import { useDatabase } from '../infra/db/client'
import { fitnessPoint } from '../infra/db/schema'
import { currentAthleteId } from '../utils/context'

/**
 * Le point de forme courant, tel que Profil l'affiche : sa valeur, sa nature
 * et sa date. Nul quand il n'y en a aucun — l'absence devient visible au lieu
 * d'être déductible (§ 9, P7.5).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)

  const [row] = await useDatabase()
    .select()
    .from(fitnessPoint)
    .where(eq(fitnessPoint.athleteId, athleteId))
    .orderBy(desc(fitnessPoint.date), desc(fitnessPoint.id))
    .limit(1)

  if (!row) return { point: null }
  return {
    point: {
      vdot: row.vdot,
      isFloor: row.isFloor,
      origin: row.origin,
      date: row.date,
      note: row.note,
    },
  }
})
