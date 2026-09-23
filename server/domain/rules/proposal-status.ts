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

export interface ProposalDates {
  /** Date de la séance visée ; nulle quand la cible n'est pas une séance. */
  targetDate: string | null
  /** Une date de destination, quand la proposition en porte une. */
  payload: Record<string, unknown> | null
}

/**
 * Une proposition dont la séance est passée, ou dont la date de destination
 * l'est, n'a plus rien à décider : elle ne s'affiche plus et le cron l'expire.
 * L'âge seul laissait « replacée avant le 22 nov. » en attente le 24 (P19).
 */
export function isOutdated(proposal: ProposalDates, today: string): boolean {
  if (proposal.targetDate !== null && proposal.targetDate < today) return true
  const deadline = proposal.payload?.date
  return typeof deadline === 'string' && deadline < today
}
