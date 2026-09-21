import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
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
 * Depuis P8.4 la session le porte toujours. Une session qui ne le porte pas
 * date d'avant les comptes : elle est fermée plutôt que rattachée au premier
 * athlète venu — sinon elle laisse naviguer sous l'identité de quelqu'un
 * d'autre, et la moitié des écrans se peint à vide.
 */
export async function currentAthleteId(event: H3Event): Promise<number> {
  const session = await getUserSession(event)
  const fromSession = session.user?.athleteId

  if (typeof fromSession !== 'number') await reject(event, 'Session périmée : reconnecte-toi.')

  /**
   * Un compte supprimé laisse une session qui pointe dans le vide. Sans cette
   * vérification, toutes les requêtes filtreraient sur un athlète inexistant
   * et rendraient un cockpit vide au lieu d'une erreur (P8.4).
   */
  const [row] = await useDatabase()
    .select({ id: athlete.id })
    .from(athlete)
    .where(eq(athlete.id, fromSession!))
    .limit(1)

  if (!row) await reject(event, 'Ce compte n’existe plus.')
  return row!.id
}

/** Ferme la session et le dit : une session à moitié valide ne sert personne. */
async function reject(event: H3Event, statusMessage: string): Promise<never> {
  await clearUserSession(event)
  throw createError({ statusCode: 401, statusMessage })
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
