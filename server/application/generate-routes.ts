import { traceFrom } from '../domain/routes/geometry'
import { toGpx } from '../domain/routes/gpx'
import type { GeoPoint, RouteTarget, RouteTrace } from '../domain/routes/route'
import { rankVariants } from '../domain/routes/validate'
import type { RouteGateway, RouteVariant, RoutingService } from './ports'

/** Trois tracés par séance, de trois graines : le § 9 en demande trois. */
export const SEEDS = [1, 2, 3]

export interface GenerateRoutesInput {
  target: RouteTarget
  /** Adresse d'où l'on part : celle du profil, ou celle du jour. */
  address: string
}

/**
 * Propose des boucles à la distance d'une séance, depuis l'adresse de départ.
 * Seule cette adresse part vers le service de routage — aucune donnée
 * d'entraînement ne l'accompagne (§ 9).
 */
export async function generateRoutes(
  gateway: RouteGateway,
  routing: RoutingService,
  input: GenerateRoutesInput,
): Promise<RouteVariant[]> {
  const origin = await routing.geocode(input.address)
  const traces = await loopTraces(routing, origin, input.target)
  const variants = toVariants(rankVariants(traces, input.target), input.target, input, origin)

  await gateway.replaceRoutes(input.target.sessionId, variants)
  return variants
}

/** Une trace par graine : trois dessins différents pour la même distance. */
async function loopTraces(
  routing: RoutingService,
  origin: GeoPoint,
  target: RouteTarget,
): Promise<(RouteTrace & { seed: number })[]> {
  const traces = await Promise.all(
    SEEDS.map(async (seed) => ({
      ...traceFrom(await routing.roundTrip(origin, target.distanceM, seed)),
      seed,
    })),
  )
  return traces.filter((trace) => trace.points.length > 1)
}

function toVariants(
  traces: (RouteTrace & { seed: number })[],
  target: RouteTarget,
  input: GenerateRoutesInput,
  origin: GeoPoint,
): RouteVariant[] {
  return traces.map((trace, rank) => ({
    sessionId: target.sessionId,
    address: input.address,
    lat: origin.lat,
    lon: origin.lon,
    date: target.date,
    code: target.code,
    targetDistanceM: target.distanceM,
    seed: trace.seed,
    distanceM: trace.distanceM,
    elevationGainM: trace.elevationGainM,
    turns: trace.turns,
    rank,
    gpx: toGpx(`${target.code} du ${target.date}`, trace.points),
  }))
}
