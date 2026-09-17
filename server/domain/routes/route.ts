import type { IsoDate } from '../plan/calendar'

/** Une boucle repart de son point de départ ; un aller mène ailleurs (§ 4). */
export enum RouteKind {
  Loop = 'boucle',
  Outbound = 'aller',
}

export interface GeoPoint {
  lat: number
  lon: number
  /** Altitude en mètres ; absente quand le service ne la donne pas. */
  elevationM?: number
}

/** Ce qu'il faut tracer : une sortie du plan, ou l'aller vers la ligne de départ. */
export interface RouteTarget {
  /** Séance visée ; nulle pour l'aller logement → départ. */
  sessionId: number | null
  date: IsoDate
  /** Code de la séance, que l'écran traduit ; nul pour l'aller. */
  code: string | null
  /** Distance visée en mètres ; nulle pour l'aller, dont la longueur est subie. */
  distanceM: number
  kind: RouteKind
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
