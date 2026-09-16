import type { IsoDate } from '../plan/calendar'
import type { Sport } from '../shared/sport'

/** Les deux formes que le § 6 autorise en sortie du modèle. */
export enum UnplannedKind {
  Activity = 'activity',
  Unavailability = 'unavailability',
}

/** Allure ressentie d'une activité hors plan, pour en estimer la charge. */
export enum IntensityProfile {
  Easy = 'facile',
  Moderate = 'modere',
  Hard = 'dur',
}

export interface UnplannedActivity {
  kind: UnplannedKind.Activity
  sport: Sport
  date: IsoDate
  durationMin: number
  /** Effort perçu estimé par le modèle, 1 à 10 ; l'athlète peut le corriger. */
  rpeEstimate: number
  intensityProfile: IntensityProfile
  /** Ce que l'athlète a écrit, conservé tel quel : « 1 h de squash ». */
  label: string
}

/** Ce qu'une indisponibilité empêche : tout, ou un seul sport. */
export enum UnavailabilityScope {
  All = 'tout',
  Running = 'course',
  Cycling = 'velo',
  Strength = 'muscu',
}

export interface UnplannedUnavailability {
  kind: UnplannedKind.Unavailability
  from: IsoDate
  /** Dernier jour couvert, inclus. Égal à `from` pour une seule journée. */
  to: IsoDate
  scope: UnavailabilityScope
  label: string
}

export type UnplannedEvent = UnplannedActivity | UnplannedUnavailability

export interface UnplannedInterpretation {
  events: UnplannedEvent[]
}

export function isActivity(event: UnplannedEvent): event is UnplannedActivity {
  return event.kind === UnplannedKind.Activity
}

export function isUnavailability(event: UnplannedEvent): event is UnplannedUnavailability {
  return event.kind === UnplannedKind.Unavailability
}

/** RPE de repli quand le modèle n'en propose pas de crédible (§ 7, point 4). */
export const DEFAULT_UNPLANNED_RPE = 5

const PROFILE_RPE: Record<IntensityProfile, number> = {
  [IntensityProfile.Easy]: 3,
  [IntensityProfile.Moderate]: 5,
  [IntensityProfile.Hard]: 7,
}

/** RPE retenu : celui du modèle s'il est dans les bornes, sinon celui du profil. */
export function rpeFor(activity: Pick<UnplannedActivity, 'rpeEstimate' | 'intensityProfile'>) {
  const { rpeEstimate, intensityProfile } = activity
  if (Number.isInteger(rpeEstimate) && rpeEstimate >= 1 && rpeEstimate <= 10) return rpeEstimate
  return PROFILE_RPE[intensityProfile] ?? DEFAULT_UNPLANNED_RPE
}

export function coversDate(unavailability: UnplannedUnavailability, date: IsoDate): boolean {
  return date >= unavailability.from && date <= unavailability.to
}

/** Cycle de vie d'un imprévu : rien n'est appliqué avant confirmation (§ 1.3). */
export enum UnplannedStatus {
  ToConfirm = 'a_confirmer',
  Confirmed = 'confirmee',
  Discarded = 'abandonnee',
}
