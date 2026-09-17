import { distanceBetween } from './geometry'
import { ROUTE_TOLERANCE, type RouteTarget, type RouteTrace } from './route'

export enum RouteRejection {
  TooShort = 'trop_courte',
  TooLong = 'trop_longue',
  TooHilly = 'trop_vallonnee',
  NotClosed = 'boucle_ouverte',
}

/**
 * Une boucle proposée doit tenir la distance de la séance à ± 10 %, rester
 * roulante (D+ ≤ 10 m/km) et revenir à son point de départ (§ 9). La fonction
 * rend la liste des raisons, pas un booléen : l'écran dit pourquoi une variante
 * a été écartée.
 */
export function rejectionsOf(trace: RouteTrace, target: RouteTarget): RouteRejection[] {
  const rejections: RouteRejection[] = []

  const low = target.distanceM * (1 - ROUTE_TOLERANCE.distancePct)
  const high = target.distanceM * (1 + ROUTE_TOLERANCE.distancePct)
  if (trace.distanceM < low) rejections.push(RouteRejection.TooShort)
  if (trace.distanceM > high) rejections.push(RouteRejection.TooLong)

  const maxGain = (trace.distanceM / 1000) * ROUTE_TOLERANCE.elevationPerKmM
  if (trace.elevationGainM > maxGain) rejections.push(RouteRejection.TooHilly)

  if (!isClosed(trace)) rejections.push(RouteRejection.NotClosed)

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
 * de disparaître : sans variante valide, mieux vaut la moins mauvaise.
 */
export function rankVariants<T extends RouteTrace>(traces: T[], target: RouteTarget): T[] {
  return [...traces].sort((a, b) => {
    const validity = Number(isValid(b, target)) - Number(isValid(a, target))
    if (validity !== 0) return validity
    if (a.elevationGainM !== b.elevationGainM) return a.elevationGainM - b.elevationGainM
    return a.turns - b.turns
  })
}
