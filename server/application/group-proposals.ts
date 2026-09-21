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

/** Une proposition déjà décidée, telle que la base la rend. */
export interface DecidedProposal {
  id: number
  ruleId: string
  effect: string
  before: string
  after: string
  status: string
  createdAt: Date | string
}

export interface DecisionGroup {
  /** Règle, effet, statut et moment : la décision telle qu'elle a été prise. */
  key: string
  ruleId: string
  effect: string
  status: string
  /** Propositions décidées ensemble ; au-delà de une, la ligne le dit. */
  count: number
  /** Nuls quand les membres ne changeaient pas la même valeur. */
  before: string | null
  after: string | null
  /**
   * Le jour où la règle s'est déclenchée — sur l'horloge du domaine, comme
   * tout le reste de l'app. `decidedAt` est écrit à l'horloge de la machine
   * et ne dirait pas la même journée sur un seed daté.
   */
  createdAt: string
}

function asIso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString()
}

/**
 * L'historique se groupe comme « À décider », avec une dimension de plus : le
 * moment. Une règle qui se redéclenche trois semaines plus tard est une autre
 * décision, pas la même — la clé porte donc la date de création, celle que
 * toutes les lignes d'une même évaluation partagent (§ 9, P7.4).
 */
export function groupDecisions(decided: DecidedProposal[]): DecisionGroup[] {
  const groups = new Map<string, DecisionGroup>()

  for (const item of decided) {
    const createdAt = asIso(item.createdAt)
    const key = `${item.status}:${item.ruleId}:${item.effect}:${createdAt}`
    const group = groups.get(key)

    if (!group) {
      groups.set(key, {
        key,
        ruleId: item.ruleId,
        effect: item.effect,
        status: item.status,
        count: 1,
        before: item.before,
        after: item.after,
        createdAt,
      })
      continue
    }

    group.count += 1
    if (group.before !== item.before) group.before = null
    if (group.after !== item.after) group.after = null
  }

  return [...groups.values()]
}
