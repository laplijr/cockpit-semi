export enum RacePriority {
  A = 'A',
  B = 'B',
  C = 'C',
}

/**
 * Une course vise un chrono — à trois niveaux — ou son propre record sur la
 * distance. Le mode record n'est offert que lorsqu'un record existe : sans
 * référence, « battre son record » ne veut rien dire (§ 5).
 */
export enum ObjectiveMode {
  Time = 'temps',
  Record = 'record',
}

export enum RaceStatus {
  Planned = 'planifiee',
  Raced = 'courue',
  Cancelled = 'annulee',
}

export enum RaceSource {
  Manual = 'manuel',
  Search = 'recherche',
}

export enum SegmentMode {
  Running = 'course',
  WalkRun = 'marche_course',
  Walking = 'marche',
}

export interface RaceIncident {
  km: number
  type: string
  note: string
}

/**
 * Ce qui, dans une course, pilote le rétro-planning (§ 5, Périodisation).
 * Le mode d'objectif n'en fait pas partie : `specsFor` ne lit que la priorité
 * et la distance, donc en changer régénérait un plan identique (§ 9, P5.15).
 */
export interface PlanningFields {
  date: string
  distanceM: number
  priority: RacePriority
}

/**
 * Une modification ne régénère le plan que si elle touche la périodisation.
 * Fixer un chrono, corriger un dénivelé ou une note change l'affichage, pas
 * le plan : régénérer pour ça jetterait des séances déjà faites (§ 9, P5.10).
 */
export function racePlansChanged(before: PlanningFields, after: PlanningFields): boolean {
  return (
    before.date !== after.date ||
    before.distanceM !== after.distanceM ||
    before.priority !== after.priority
  )
}
