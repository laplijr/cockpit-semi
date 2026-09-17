import type { AthleteConstraints } from '../domain/athlete/constraints'
import type { PauseAllowances } from '../domain/pause/pause'
import type { IsoDate } from '../domain/plan/calendar'
import type { GeneratedPlan } from '../domain/plan/generate'
import type { PlannedRace } from '../domain/plan/periodization'
import type { PlanTrigger } from '../domain/plan/session'
import type { GeoPoint, RouteKind } from '../domain/routes/route'
import type { RouteSession } from '../domain/routes/targets'

export type { Clock } from '../domain/shared/clock'

export interface AthleteSnapshot {
  constraints: AthleteConstraints
  startWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  /** Montée hebdomadaire maximale, en pourcentage ; déduite du profil (§ 5). */
  maxWeeklyIncreasePct: number
  onboarded: boolean
}

export interface PauseSnapshot {
  id: number
  type: string
  zone: string | null
  startDate: IsoDate
  estimatedEndDate: IsoDate | null
  /** Nulle tant que la pause est ouverte. */
  endDate: IsoDate | null
  allowances: PauseAllowances
  watchZones: string[]
  notes: string | null
}

export interface FitnessSnapshot {
  vdot: number
  isFloor: boolean
  date: IsoDate
}

/** Tout ce dont la génération a besoin pour lire l'état courant et l'écrire. */
export interface PlanGateway {
  loadAthlete(): Promise<AthleteSnapshot | undefined>
  loadRaces(): Promise<PlannedRace[]>
  /** Dernière pause, ouverte ou fermée : sa fin déclenche la reprise surveillée. */
  loadLatestPause(): Promise<PauseSnapshot | undefined>
  loadCurrentFitness(): Promise<FitnessSnapshot | undefined>
  /** Date du dernier test 20′, qui borne la replanification du suivant. */
  loadLastTestDate(): Promise<IsoDate | null>
  savePlan(plan: GeneratedPlan, trigger: PlanTrigger, parameters: PlanParameters): Promise<number>
}

export interface RouteRaceSnapshot {
  id: number
  name: string
  date: IsoDate
  /** Ligne de départ ; nulle tant qu'elle n'est pas saisie (§ 4). */
  startAddress: string | null
}

/** Une variante prête à être enregistrée, mesurée et classée (§ 4). */
export interface RouteVariant {
  address: string
  lat: number
  lon: number
  sessionId: number | null
  date: IsoDate
  code: string | null
  kind: RouteKind
  targetDistanceM: number
  seed: number
  distanceM: number
  elevationGainM: number
  turns: number
  rank: number
  gpx: string
}

/** Service de tracé : géocodage et itinéraires piétons (§ 9, OpenRouteService). */
export interface RoutingService {
  geocode(address: string): Promise<GeoPoint>
  /** Boucle partant et revenant au même point, dessinée depuis une graine. */
  roundTrip(start: GeoPoint, distanceM: number, seed: number): Promise<GeoPoint[]>
  /** Aller simple, pour le logement → ligne de départ. */
  legTo(start: GeoPoint, destination: GeoPoint): Promise<GeoPoint[]>
}

export interface RouteGateway {
  loadRace(raceId: number): Promise<RouteRaceSnapshot | undefined>
  /** Séances du plan actif, d'où sortent les cibles (§ 9). */
  loadPlannedSessions(): Promise<RouteSession[]>
  /** Une génération remplace la précédente : on ne cumule pas les variantes. */
  replaceRoutes(raceId: number, variants: RouteVariant[]): Promise<void>
}

export interface PlanParameters extends Record<string, unknown> {
  baseWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  vdot: number
  vdotIsFloor: boolean
  provisional: boolean
}
