/**
 * Regroupement des propositions en attente : une décision par règle et par
 * effet, pas une par séance. Quatre musculations allégées par la même règle
 * sont une seule décision — sinon la zone « À décider » aligne des lignes
 * indistinguables et gouverne la hauteur du cockpit (§ 9, P5.19).
 */

/** Ce que la cible d'une proposition est, quand c'est une séance. */
export interface ProposalTargetSession {
  id: number
  code: string
  date: string
  sport: string
}

export interface PendingProposal {
  id: number
  ruleId: string
  effect: string
  targetKind: string
  targetId: number | null
  before: string
  after: string
  explanation: string
  target: ProposalTargetSession | null
}

export interface ProposalGroup {
  /** Identifiant de la décision : la règle et son effet. */
  key: string
  ruleId: string
  effect: string
  /** Propositions décidées ensemble par ce groupe. */
  ids: number[]
  /** Nuls quand les membres ne changent pas la même valeur. */
  before: string | null
  after: string | null
  explanation: string
  targets: ProposalTargetSession[]
}

export function groupProposals(pending: PendingProposal[]): ProposalGroup[] {
  const groups = new Map<string, ProposalGroup>()

  for (const item of pending) {
    const key = `${item.ruleId}:${item.effect}`
    const group = groups.get(key)

    if (!group) {
      groups.set(key, {
        key,
        ruleId: item.ruleId,
        effect: item.effect,
        ids: [item.id],
        before: item.before,
        after: item.after,
        explanation: item.explanation,
        targets: item.target ? [item.target] : [],
      })
      continue
    }

    group.ids.push(item.id)
    if (item.target) group.targets.push(item.target)
    if (group.before !== item.before) group.before = null
    if (group.after !== item.after) group.after = null
  }

  return [...groups.values()]
}
