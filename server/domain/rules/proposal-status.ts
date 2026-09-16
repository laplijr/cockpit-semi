export enum ProposalStatus {
  Proposed = 'proposee',
  Accepted = 'acceptee',
  Refused = 'refusee',
  Expired = 'expiree',
}

/** Ce qui a déclenché l'évaluation des règles. */
export enum ProposalTrigger {
  Feedback = 'ressenti',
  DailyCron = 'cron_quotidien',
  Regeneration = 'regeneration',
  Unplanned = 'imprevu',
  RaceLookup = 'reverification_course',
}
