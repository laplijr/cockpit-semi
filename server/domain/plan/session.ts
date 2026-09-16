export enum SessionStatus {
  Planned = 'prevue',
  Done = 'faite',
  Modified = 'modifiee',
  Skipped = 'sautee',
}

export enum SessionOrigin {
  Plan = 'plan',
  Unplanned = 'imprevu',
  Import = 'import',
}

/** Ce qui a provoqué la génération d'une version de plan (§ 4). */
export enum PlanTrigger {
  Onboarding = 'onboarding',
  RaceAdded = 'course_ajoutee',
  Pause = 'pause',
  Resume = 'reprise',
  ProposalAccepted = 'recalcul_accepte',
}
