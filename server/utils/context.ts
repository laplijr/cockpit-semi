import { createClock } from '../domain/shared/clock'
import { useDatabase } from '../infra/db/client'
import { createPlanGateway } from '../infra/db/plan-gateway'
import { createRouteGateway } from '../infra/db/route-gateway'
import { createRoutingService } from '../infra/routing/openrouteservice'

/**
 * Horloge de l'application. `NUXT_COCKPIT_TODAY` la fige à une date simulée
 * pour explorer le cockpit avec un historique ; elle n'est définie qu'en local.
 */
export const systemClock = createClock(process.env.NUXT_COCKPIT_TODAY)

export function planGateway() {
  return createPlanGateway(useDatabase())
}

export function routeGateway() {
  return createRouteGateway(useDatabase())
}

export function routingService() {
  return createRoutingService()
}
