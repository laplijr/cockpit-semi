import { Sport } from '../shared/sport'
import { StrengthEquipment } from '../strength/equipment'
import { StrengthIntent } from '../strength/intent'

export const MONDAY = 1
export const SUNDAY = 7

export interface AthleteConstraints {
  /** Jours où l'athlète peut s'entraîner, 1 = lundi … 7 = dimanche. */
  availableDays: number[]
  /** Jour de la sortie longue ; par défaut le dernier jour disponible. */
  longRunDay?: number
  /** Jours qui restent faciles quoi qu'il arrive (« lundi facile », § 5). */
  easyDays?: number[]
  /**
   * Nombre de courses par semaine, 2 à 6. Les jours disponibles disent où
   * courir, pas combien : sans valeur, le défaut de la phase s'applique (§ 5).
   */
  runsPerWeek?: number
  /**
   * Sports pratiqués. Sans valeur, les trois d'aujourd'hui : un plan déjà
   * généré ne bouge pas. La course ne se retire pas, c'est le moteur (§ 5).
   */
  sports?: Sport[]
  /**
   * Programme de renforcement. Sans valeur, `complet` : un plan déjà généré
   * ne bouge pas, exactement comme pour `sports` (§ 5, P11.2).
   */
  strengthIntent?: StrengthIntent
  /**
   * Matériel disponible. Sans valeur, la salle : c'est l'hypothèse tacite de
   * tout ce qui a été prescrit jusqu'ici (§ 5, P11.3).
   */
  equipment?: StrengthEquipment
  notes?: string[]
}

/** Vrai quand le sport est pratiqué, ou qu'aucune liste n'a été déclarée (§ 5). */
export function practises(constraints: AthleteConstraints, sport: Sport): boolean {
  if (sport === Sport.Running) return true
  return constraints.sports === undefined || constraints.sports.includes(sport)
}

/** Intention déclarée, ou celle d'aujourd'hui quand rien n'a été dit (§ 5, P11.2). */
export function strengthIntentOf(constraints: AthleteConstraints): StrengthIntent {
  return constraints.strengthIntent ?? StrengthIntent.Complete
}

/** Matériel déclaré, ou celui qu'on supposait sans le dire (§ 5, P11.3). */
export function equipmentOf(constraints: AthleteConstraints): StrengthEquipment {
  return constraints.equipment ?? StrengthEquipment.Gym
}

export const DEFAULT_CONSTRAINTS: AthleteConstraints = { availableDays: [] }

/** Volumes par défaut, à ajuster dans Profil au fil de l'historique saisi (§ 5). */
export const DEFAULT_START_VOLUME_M = 20_000
export const DEFAULT_PEAK_VOLUME_M = 45_000

export const MIN_RUNS_PER_WEEK = 2
export const MAX_RUNS_PER_WEEK = 6
