export interface GeoPoint {
  lat: number
  lon: number
  /** Altitude en mètres ; absente quand le service ne la donne pas. */
  elevationM?: number
}

/**
 * Ce qu'il faut tracer : une séance à venir, depuis l'adresse d'où on part.
 * L'itinéraire sert l'entraînement — on part de chez soi ou d'où l'on est, et
 * on revient au même point.
 */
export interface RouteTarget {
  sessionId: number
  date: string
  /** Code de la séance, que l'écran traduit. */
  code: string
  distanceM: number
}

/** Une trace mesurée, indépendante de sa source (GPX lu ou service appelé). */
export interface RouteTrace {
  points: GeoPoint[]
  distanceM: number
  elevationGainM: number
  turns: number
}

/**
 * OpenRouteService vise la longueur demandée sans la tenir : il rend des
 * boucles 10 à 20 % trop longues. Un second appel avec la longueur corrigée
 * proportionnellement recadre la trace. Le facteur est borné : au-delà, ce
 * n'est plus une correction, c'est un autre trajet.
 */
export const LENGTH_CORRECTION_BOUNDS = { min: 0.6, max: 1.6 } as const

export function correctedLength(requestedM: number, obtainedM: number, targetM: number): number {
  if (obtainedM <= 0) return requestedM
  const factor = targetM / obtainedM
  const bounded = Math.min(
    LENGTH_CORRECTION_BOUNDS.max,
    Math.max(LENGTH_CORRECTION_BOUNDS.min, factor),
  )
  return Math.round(requestedM * bounded)
}

/** Tolérances du § 9 : ce qu'une trace doit respecter pour être proposée. */
export const ROUTE_TOLERANCE = {
  /** Écart maximal à la distance visée, en fraction. */
  distancePct: 0.1,
  /** D+ maximal par kilomètre, en mètres. */
  elevationPerKmM: 10,
  /** Écart maximal entre le départ et l'arrivée d'une boucle, en mètres. */
  loopClosureM: 50,
} as const
