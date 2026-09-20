import type { Prescription } from '../shared/prescription'
import type { Sport } from '../shared/sport'
import type { IsoDate } from './calendar'

export enum SessionStatus {
  Planned = 'prevue',
  Done = 'faite',
  Modified = 'modifiee',
  Skipped = 'sautee',
  /**
   * Retirée d'avance par Ronan. Ce n'est pas une séance manquée : les
   * détecteurs d'apprentissage comptent les secondes, pas celle-ci (§ 5).
   */
  Cancelled = 'annulee',
}

export enum SessionOrigin {
  Plan = 'plan',
  Unplanned = 'imprevu',
  Import = 'import',
  /** Posée ou retouchée à la main : sa journée est gelée (§ 5, P6.43). */
  Manual = 'manuelle',
}

/** Ce qui a provoqué la génération d'une version de plan (§ 4). */
export enum PlanTrigger {
  Onboarding = 'onboarding',
  RaceAdded = 'course_ajoutee',
  RaceEdited = 'course_modifiee',
  Pause = 'pause',
  Resume = 'reprise',
  ProposalAccepted = 'recalcul_accepte',
  TestRecorded = 'test_enregistre',
  RaceRecorded = 'resultat_enregistre',
  /** Une journée posée à la main est rendue au générateur (§ 5, P6.43). */
  DayRestored = 'journee_rendue',
}

/** Une séance telle qu'elle est stockée, lue par les modules qui la retouchent. */
export interface PlannedSessionRecord {
  id: number
  date: IsoDate
  sport: Sport
  code: string
  status: SessionStatus
  key: boolean
  prescription: Prescription
}
