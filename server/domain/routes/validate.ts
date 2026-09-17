import { distanceBetween } from './geometry'
import { ROUTE_TOLERANCE, RouteKind, type RouteTarget, type RouteTrace } from './route'

export enum RouteRejection {
  TooShort = 'trop_courte',
  TooLong = 'trop_longue',
  TooHilly = 'trop_vallonnee',
  NotClosed = 'boucle_ouverte',
}

/**
 * Une trace proposée doit tenir la distance visée à ± 10 %, rester roulante
 * (D+ ≤ 10 m/km) et, pour une boucle, revenir à son point de départ (§ 9).
 * La fonction rend la liste des raisons, pas un booléen : l'écran dit pourquoi
 * une variante a été écartée.
 */
export function rejectionsOf(trace: RouteTrace, target: RouteTarget): RouteRejection[] {
  const rejections: RouteRejection[] = []

  if (target.distanceM > 0) {
    const low = target.distanceM * (1 - ROUTE_TOLERANCE.distancePct)
    const high = target.distanceM * (1 + ROUTE_TOLERANCE.distancePct)
    if (trace.distanceM < low) rejections.push(RouteRejection.TooShort)
    if (trace.distanceM > high) rejections.push(RouteRejection.TooLong)
  }

  /**
   * Le relief et la fermeture ne jugent que les boucles : l'aller vers la ligne
   * de départ est subi, il n'y a pas de variante plus plate à choisir.
   */
  if (target.kind === RouteKind.Loop) {
    const maxGain = (trace.distanceM / 1000) * ROUTE_TOLERANCE.elevationPerKmM
    if (trace.elevationGainM > maxGain) rejections.push(RouteRejection.TooHilly)
    if (!isClosed(trace)) rejections.push(RouteRejection.NotClosed)
  }

  return rejections
}

export function isValid(trace: RouteTrace, target: RouteTarget): boolean {
  return rejectionsOf(trace, target).length === 0
}

function isClosed(trace: RouteTrace): boolean {
  const start = trace.points.at(0)
  const end = trace.points.at(-1)
  if (!start || !end) return false
  return distanceBetween(start, end) <= ROUTE_TOLERANCE.loopClosureM
}

/**
 * À distance tenue, la meilleure variante est la plus plate ; à D+ égal, celle
 * qui tourne le moins (§ 9). Les traces invalides restent en queue plutôt que
 * de disparaître : sans réseau ni variante valide, mieux vaut la moins mauvaise.
 */
export function rankVariants<T extends RouteTrace>(traces: T[], target: RouteTarget): T[] {
  return [...traces].sort((a, b) => {
    const validity = Number(isValid(b, target)) - Number(isValid(a, target))
    if (validity !== 0) return validity
    if (a.elevationGainM !== b.elevationGainM) return a.elevationGainM - b.elevationGainM
    return a.turns - b.turns
  })
}
