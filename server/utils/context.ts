import type { H3Event } from 'h3'
import { asc, eq } from 'drizzle-orm'
import { createClock } from '../domain/shared/clock'
import { useDatabase } from '../infra/db/client'
import { createPlanGateway } from '../infra/db/plan-gateway'
import { createRouteGateway } from '../infra/db/route-gateway'
import { createRoutingService } from '../infra/routing/openrouteservice'
import { athlete } from '../infra/db/schema'

/**
 * Horloge de l'application. `NUXT_COCKPIT_TODAY` la fige à une date simulée
 * pour explorer le cockpit avec un historique ; elle n'est définie qu'en local.
 */
export const systemClock = createClock(process.env.NUXT_COCKPIT_TODAY)

/**
 * Athlète de la requête courante. Il traverse l'application comme l'horloge :
 * le domaine ignore qui est connecté (§ 3), seule la couche application le
 * reçoit en paramètre.
 *
 * La session ne le porte pas encore — c'est P8.4 qui l'y met, avec les vrais
 * comptes. En attendant, la porte est unique et la base n'a qu'un athlète :
 * le plus ancien fait foi.
 */
export async function currentAthleteId(event: H3Event): Promise<number> {
  const session = await getUserSession(event)
  const fromSession = (session.user as { athleteId?: number } | undefined)?.athleteId
  if (typeof fromSession === 'number') return fromSession

  const [row] = await useDatabase()
    .select({ id: athlete.id })
    .from(athlete)
    .orderBy(asc(athlete.id))
    .limit(1)

  if (!row) throw createError({ statusCode: 409, statusMessage: 'Aucun athlète en base' })
  return row.id
}

/** Athlète courant tel que la couche application le lit, ligne complète. */
export async function loadAthlete(athleteId: number) {
  const [row] = await useDatabase().select().from(athlete).where(eq(athlete.id, athleteId)).limit(1)
  return row
}

export function planGateway(athleteId: number) {
  return createPlanGateway(useDatabase(), athleteId)
}

export function routeGateway(athleteId: number) {
  return createRouteGateway(useDatabase(), athleteId)
}

export function routingService() {
  return createRoutingService()
}
