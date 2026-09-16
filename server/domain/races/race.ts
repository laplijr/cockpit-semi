export enum RacePriority {
  A = 'A',
  B = 'B',
  C = 'C',
}

/** Une course vise un chrono, ou la meilleure performance possible du jour. */
export enum ObjectiveMode {
  Time = 'temps',
  MaxPerformance = 'performance_max',
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
