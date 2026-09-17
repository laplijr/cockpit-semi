import type { GeoPoint, RouteTrace } from './route'

const EARTH_RADIUS_M = 6_371_000

/**
 * Bruit d'altitude des services de routage : une dent de scie de quelques
 * mètres n'est pas du dénivelé. Seules les montées au-delà de ce seuil comptent.
 */
const ELEVATION_NOISE_M = 2

/** Au-delà de cet angle entre deux segments, on a tourné. */
const TURN_ANGLE_DEG = 40

/** Deux points trop proches donnent un cap instable : ils ne comptent pas. */
const TURN_MIN_SEGMENT_M = 15

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export function distanceBetween(from: GeoPoint, to: GeoPoint): number {
  const phi1 = toRadians(from.lat)
  const phi2 = toRadians(to.lat)
  const dPhi = toRadians(to.lat - from.lat)
  const dLambda = toRadians(to.lon - from.lon)

  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function totalDistance(points: GeoPoint[]): number {
  return points.reduce(
    (sum, point, index) => (index === 0 ? 0 : sum + distanceBetween(points[index - 1]!, point)),
    0,
  )
}

/** Somme des montées, une fois le bruit d'altitude filtré. */
export function elevationGain(points: GeoPoint[]): number {
  let gain = 0
  let reference: number | undefined

  for (const point of points) {
    if (point.elevationM === undefined) continue
    if (reference === undefined) {
      reference = point.elevationM
      continue
    }

    const rise = point.elevationM - reference
    if (rise >= ELEVATION_NOISE_M) {
      gain += rise
      reference = point.elevationM
    } else if (rise < 0) {
      reference = point.elevationM
    }
  }

  return Math.round(gain)
}

/** Cap d'un segment en degrés, 0 au nord. */
function bearing(from: GeoPoint, to: GeoPoint): number {
  const phi1 = toRadians(from.lat)
  const phi2 = toRadians(to.lat)
  const dLambda = toRadians(to.lon - from.lon)

  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Nombre de virages : les changements de cap marqués entre segments assez longs
 * pour porter un cap. C'est le second critère de classement (§ 9) — à D+ égal,
 * la trace qui tourne le moins se court sans y penser.
 */
export function countTurns(points: GeoPoint[]): number {
  const legs: number[] = []
  let anchor = points[0]

  for (const point of points.slice(1)) {
    if (anchor === undefined) break
    if (distanceBetween(anchor, point) < TURN_MIN_SEGMENT_M) continue
    legs.push(bearing(anchor, point))
    anchor = point
  }

  return legs.reduce((turns, heading, index) => {
    if (index === 0) return 0
    const delta = Math.abs(heading - legs[index - 1]!)
    return turns + (Math.min(delta, 360 - delta) >= TURN_ANGLE_DEG ? 1 : 0)
  }, 0)
}

export function traceFrom(points: GeoPoint[]): RouteTrace {
  return {
    points,
    distanceM: Math.round(totalDistance(points)),
    elevationGainM: elevationGain(points),
    turns: countTurns(points),
  }
}
