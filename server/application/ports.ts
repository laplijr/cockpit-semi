import type { AthleteConstraints } from '../domain/athlete/constraints'
import type { ForecastTarget } from '../domain/fitness/accuracy'
import type { PauseAllowances } from '../domain/pause/pause'
import type { IsoDate } from '../domain/plan/calendar'
import type { GeneratedPlan } from '../domain/plan/generate'
import type { PlannedRace } from '../domain/plan/periodization'
import type { PlanTrigger } from '../domain/plan/session'
import type { GeoPoint, RouteTarget } from '../domain/routes/route'

export type { Clock } from '../domain/shared/clock'

export interface AthleteSnapshot {
  constraints: AthleteConstraints
  startWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  /** Montée hebdomadaire maximale, en pourcentage ; déduite du profil (§ 5). */
  maxWeeklyIncreasePct: number
  /** Progression estimée par bloc de huit semaines, celle que R9 recale (§ 5). */
  vdotGainPerBlock: number
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

/** Une course telle que la boucle de crédibilité la juge (§ 9, P6.6). */
export interface ForecastRaceSnapshot {
  id: number
  date: IsoDate
  distanceM: number
  elevationGainM: number | null
  expectedTempC: number | null
  /** Chrono visé, ou record à battre ; nul tant qu'il n'est pas fixé. */
  targetS: number | null
  /** Chrono couru et représentatif ; nul tant que la course n'a pas eu lieu. */
  resultS: number | null
}

/** Une prévision émise dont l'échéance n'a pas encore été confrontée. */
export interface OpenForecast {
  id: number
  target: ForecastTarget
  raceId: number | null
  issuedDate: IsoDate
  /** Ce qui avait été annoncé : l'écart se mesure contre cette valeur. */
  projectedVdot: number
}

export interface ForecastContext {
  /** Tests 20′ dans l'ordre du temps : ils résolvent les prévisions de test. */
  tests: { date: IsoDate; vdot: number }[]
  races: ForecastRaceSnapshot[]
  open: OpenForecast[]
}

export interface IssuedForecast {
  target: ForecastTarget
  raceId: number | null
  issuedDate: IsoDate
  targetDate: IsoDate
  projectedVdot: number
  lowVdot: number
  highVdot: number
  confidencePct: number | null
}

export interface ForecastResolution {
  id: number
  actualVdot: number
  gapVdot: number
  resolvedDate: IsoDate
}

/** Tout ce dont la génération a besoin pour lire l'état courant et l'écrire. */
export interface PlanGateway {
  loadAthlete(): Promise<AthleteSnapshot | undefined>
  loadRaces(): Promise<PlannedRace[]>
  /** Dernière pause, ouverte ou fermée : sa fin déclenche la reprise surveillée. */
  loadLatestPause(): Promise<PauseSnapshot | undefined>
  /** La forme du jour donné : la règle de fraîcheur en dépend (§ 5, P7.5). */
  loadCurrentFitness(today: IsoDate): Promise<FitnessSnapshot | undefined>
  /** Date du dernier test 20′, qui borne la replanification du suivant. */
  loadLastTestDate(): Promise<IsoDate | null>
  savePlan(plan: GeneratedPlan, trigger: PlanTrigger, parameters: PlanParameters): Promise<number>
  /**
   * Sérialise les régénérations d'un même athlète. Deux qui s'entrelacent se
   * suppriment leurs séances et laissent une version active vide (§ 5, P8.5).
   */
  withPlanLock<T>(run: () => Promise<T>): Promise<T>
  /** Prévisions ouvertes et ce qui permet d'en émettre de nouvelles (§ 9, P6.6). */
  loadForecastContext(): Promise<ForecastContext>
  /** Résout les prévisions échues et enregistre celles du jour, d'un seul bloc. */
  saveForecasts(resolved: ForecastResolution[], issued: IssuedForecast[]): Promise<void>
}

/** Une variante prête à être enregistrée, mesurée et classée (§ 4). */
export interface RouteVariant {
  sessionId: number
  address: string
  lat: number
  lon: number
  date: IsoDate
  code: string
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

/** Le tirage en place pour une séance : d'où il part, et où ses graines sont allées. */
export interface LastDraw {
  address: string
  origin: GeoPoint
  lastSeed: number
}

export interface RouteGateway {
  /** La séance visée, telle qu'elle se lit dans le plan actif. */
  loadTarget(sessionId: number): Promise<RouteTarget | undefined>
  /** Adresse de départ des sorties, saisie dans Profil ; nulle tant qu'elle manque. */
  loadHomeAddress(): Promise<string | null>
  /**
   * Le tirage déjà en place, pour en demander un de plus sans redemander
   * l'origine — ni la géocoder deux fois (§ 9, P15). Nul tant qu'il n'y en a pas.
   */
  loadLastDraw(sessionId: number): Promise<LastDraw | null>
  /** Une génération remplace la précédente : on ne cumule pas les variantes. */
  replaceRoutes(sessionId: number, variants: RouteVariant[]): Promise<void>
}

export interface PlanParameters extends Record<string, unknown> {
  baseWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  vdot: number
  vdotIsFloor: boolean
  /** Progression estimée en vigueur à la génération : le dialog VDOT la cite. */
  gainPerBlock: number
  provisional: boolean
}
