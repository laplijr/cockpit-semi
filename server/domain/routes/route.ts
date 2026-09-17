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

/** Tolérances du § 9 : ce qu'une trace doit respecter pour être proposée. */
export const ROUTE_TOLERANCE = {
  /** Écart maximal à la distance visée, en fraction. */
  distancePct: 0.1,
  /** D+ maximal par kilomètre, en mètres. */
  elevationPerKmM: 10,
  /** Écart maximal entre le départ et l'arrivée d'une boucle, en mètres. */
  loopClosureM: 50,
} as const
