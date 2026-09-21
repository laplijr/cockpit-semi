import type { IsoDate } from '../plan/calendar'

/** Les trois entrées possibles du VDOT de départ (§ 5, P8.1). */
export enum FitnessDeclaration {
  Chrono = 'chrono',
  EasyPace = 'allure',
  Unknown = 'inconnu',
}

export interface ChronoDeclaration {
  kind: FitnessDeclaration.Chrono
  distanceM: number
  timeS: number
  date: IsoDate
}

export interface EasyPaceDeclaration {
  kind: FitnessDeclaration.EasyPace
  /** Allure d'endurance tenue confortablement, en secondes par kilomètre. */
  paceSecPerKm: number
}

export interface UnknownDeclaration {
  kind: FitnessDeclaration.Unknown
}

export type StartingFitness = ChronoDeclaration | EasyPaceDeclaration | UnknownDeclaration
