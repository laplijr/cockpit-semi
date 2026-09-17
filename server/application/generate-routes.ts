import { addDays, type IsoDate } from '../domain/plan/calendar'
import { traceFrom } from '../domain/routes/geometry'
import { toGpx } from '../domain/routes/gpx'
import { RouteKind, type GeoPoint, type RouteTarget, type RouteTrace } from '../domain/routes/route'
import { routeTargets } from '../domain/routes/targets'
import { rankVariants } from '../domain/routes/validate'
import type { RouteGateway, RouteRaceSnapshot, RouteVariant, RoutingService } from './ports'

/** Trois tracés par cible, de trois graines : le § 9 en demande trois. */
export const SEEDS = [1, 2, 3]

export interface GenerateRoutesInput {
  race: RouteRaceSnapshot
  /** Adresse du logement sur place, saisie par l'athlète. */
  address: string
  /** Arrivée sur place ; par défaut la veille de la course (§ 9). */
  arrivalDate?: IsoDate
}

/**
 * Génère les itinéraires d'un séjour de course : une boucle par sortie prévue
 * sur place, plus l'aller vers la ligne de départ. Seule l'adresse saisie part
 * vers le service de routage — aucune donnée d'entraînement (§ 9).
 */
export async function generateRoutes(
  gateway: RouteGateway,
  routing: RoutingService,
  input: GenerateRoutesInput,
): Promise<RouteVariant[]> {
  const { race } = input
  const arrivalDate = input.arrivalDate ?? addDays(race.date, -1)
  const targets = routeTargets({
    sessions: await gateway.loadPlannedSessions(),
    arrivalDate,
    raceDate: race.date,
    hasStartAddress: race.startAddress !== null,
  })

  const origin = await routing.geocode(input.address)
  const startLine = race.startAddress ? await routing.geocode(race.startAddress) : null

  const variants: RouteVariant[] = []
  for (const target of targets) {
    const traces =
      target.kind === RouteKind.Loop
        ? await loopTraces(routing, origin, target)
        : await legTraces(routing, origin, startLine)

    variants.push(...toVariants(rankVariants(traces, target), target, input.address, origin))
  }

  await gateway.replaceRoutes(race.id, variants)
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

/** L'aller n'a pas de variante : il n'y a qu'un chemin à prendre. */
async function legTraces(
  routing: RoutingService,
  origin: GeoPoint,
  startLine: GeoPoint | null,
): Promise<(RouteTrace & { seed: number })[]> {
  if (!startLine) return []
  const trace = traceFrom(await routing.legTo(origin, startLine))
  return trace.points.length > 1 ? [{ ...trace, seed: 0 }] : []
}

function toVariants(
  traces: (RouteTrace & { seed: number })[],
  target: RouteTarget,
  address: string,
  origin: GeoPoint,
): RouteVariant[] {
  return traces.map((trace, rank) => ({
    address,
    lat: origin.lat,
    lon: origin.lon,
    sessionId: target.sessionId,
    date: target.date,
    code: target.code,
    kind: target.kind,
    targetDistanceM: target.distanceM,
    seed: trace.seed,
    distanceM: trace.distanceM,
    elevationGainM: trace.elevationGainM,
    turns: trace.turns,
    rank,
    gpx: toGpx(gpxName(target), trace.points),
  }))
}

function gpxName(target: RouteTarget): string {
  return target.kind === RouteKind.Loop
    ? `${target.code ?? 'Sortie'} du ${target.date}`
    : `Logement → départ, ${target.date}`
}
