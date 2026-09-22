import { traceFrom } from '../domain/routes/geometry'
import { toGpx } from '../domain/routes/gpx'
import {
  correctedLength,
  type GeoPoint,
  type RouteTarget,
  type RouteTrace,
} from '../domain/routes/route'
import { RouteRejection, rankVariants, rejectionsOf } from '../domain/routes/validate'
import type { RouteGateway, RouteVariant, RoutingService } from './ports'

/** Trois tracés par tirage, de trois graines : le § 9 en demande trois. */
export const VARIANTS_PER_DRAW = 3

/**
 * Les graines d'un tirage ne repartent pas de 1 à chaque fois : depuis la même
 * origine, la même graine redonne la même boucle, et « Autre boucle »
 * proposerait ce qu'on vient de voir (§ 9, P15).
 */
function seedsFrom(base: number): number[] {
  return Array.from({ length: VARIANTS_PER_DRAW }, (_, index) => base + index)
}

export interface GenerateRoutesInput {
  target: RouteTarget
  /** Adresse d'où l'on part : celle du profil, ou celle du jour. */
  address: string
  /**
   * Position donnée par l'appareil. Quand elle est là, rien n'est géocodé :
   * on part d'où l'on est, et l'adresse n'est plus qu'une étiquette (P10.3).
   */
  origin?: GeoPoint
  /** Première graine du tirage : un tirage de plus repart après le précédent. */
  seedBase?: number
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
  const origin = input.origin ?? (await routing.geocode(input.address))
  const traces = await loopTraces(routing, origin, input.target, input.seedBase ?? 1)
  const variants = toVariants(rankVariants(traces, input.target), input.target, input, origin)

  await gateway.replaceRoutes(input.target.sessionId, variants)
  return variants
}

type SeededTrace = RouteTrace & { seed: number }

/**
 * Une trace par graine, puis un second appel quand la longueur rendue sort de
 * la tolérance : le service vise la distance demandée sans la tenir, et une
 * correction proportionnelle suffit à recadrer la boucle.
 */
async function loopTraces(
  routing: RoutingService,
  origin: GeoPoint,
  target: RouteTarget,
  seedBase: number,
): Promise<SeededTrace[]> {
  const draw = async (seed: number, lengthM: number): Promise<SeededTrace> => ({
    ...traceFrom(await routing.roundTrip(origin, lengthM, seed)),
    seed,
  })

  const first = await Promise.all(seedsFrom(seedBase).map((seed) => draw(seed, target.distanceM)))

  const corrected = await Promise.all(
    first.map(async (trace) => {
      if (trace.points.length < 2 || withinTolerance(trace, target)) return trace
      const length = correctedLength(target.distanceM, trace.distanceM, target.distanceM)
      return closerTo(target, trace, await draw(trace.seed, length))
    }),
  )

  return corrected.filter((trace) => trace.points.length > 1)
}

function withinTolerance(trace: RouteTrace, target: RouteTarget): boolean {
  return !rejectionsOf(trace, target).some(
    (rejection) => rejection === RouteRejection.TooShort || rejection === RouteRejection.TooLong,
  )
}

function closerTo(target: RouteTarget, first: SeededTrace, second: SeededTrace): SeededTrace {
  if (second.points.length < 2) return first
  const gap = (trace: RouteTrace) => Math.abs(trace.distanceM - target.distanceM)
  return gap(second) < gap(first) ? second : first
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
