import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../infra/db/client'
import { athleteWeekIds } from '../infra/db/plan-gateway'
import { race, route, session } from '../infra/db/schema'

/**
 * Un identifiant qui vient de l'URL n'appartient à personne tant qu'on ne l'a
 * pas vérifié. Ces trois portes le font, et rendent 404 plutôt que 403 : dire
 * « cette séance existe mais pas pour toi » serait déjà en dire trop (P8.3).
 */
export async function ownedSession(db: Database, athleteId: number, sessionId: number) {
  const [row] = await db
    .select()
    .from(session)
    .where(and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  return row
}

export async function ownedRace(db: Database, athleteId: number, raceId: number) {
  const [row] = await db
    .select()
    .from(race)
    .where(and(eq(race.id, raceId), eq(race.athleteId, athleteId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Course inconnue' })
  return row
}

export async function ownedRoute(db: Database, athleteId: number, routeId: number) {
  const [row] = await db
    .select()
    .from(route)
    .innerJoin(session, eq(route.sessionId, session.id))
    .where(and(eq(route.id, routeId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Itinéraire inconnu' })
  return row.route
}
