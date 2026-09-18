import type { ProposalGroup, ProposalTargetSession } from '~~/server/application/group-proposals'

export interface ProposalRow {
  id: number
  trigger: string
  ruleId: string
  effect: string
  targetKind: string
  targetId: number | null
  before: string
  after: string
  explanation: string
  status: string
  createdAt: string
  decidedAt: string | null
}

export type PendingRow = ProposalRow & { target: ProposalTargetSession | null }

interface ProposalsPayload {
  pending: PendingRow[]
  groups: ProposalGroup[]
  decided: ProposalRow[]
}

/**
 * Ce qui se décide est un groupe — une règle et son effet — pas une ligne :
 * quatre séances allégées par la même règle font une seule décision (§ 9, P5.19).
 */
export const usePropositionsStore = defineStore('proposals', () => {
  const pending = ref<PendingRow[]>([])
  const groups = ref<ProposalGroup[]>([])
  const decided = ref<ProposalRow[]>([])
  const selected = ref<string[]>([])
  /** Vrai dès la première réponse : une recharge garde la liste déjà affichée. */
  const loaded = ref(false)
  const request = useRequestFetch()

  async function load() {
    const payload = await request<ProposalsPayload>('/api/proposals')
    pending.value = payload.pending
    groups.value = payload.groups
    decided.value = payload.decided
    selected.value = selected.value.filter((key) =>
      payload.groups.some((group) => group.key === key),
    )
    loaded.value = true
  }

  function toggle(key: string) {
    const index = selected.value.indexOf(key)
    if (index === -1) selected.value.push(key)
    else selected.value.splice(index, 1)
  }

  function idsOf(keys: string[]): number[] {
    return groups.value.filter((group) => keys.includes(group.key)).flatMap((group) => group.ids)
  }

  /** Applique les décisions cochées : toutes les lignes de chaque groupe. */
  async function applySelected() {
    for (const id of idsOf([...selected.value])) {
      await request(`/api/proposals/${id}/accept`, { method: 'POST' })
    }
    selected.value = []
    await load()
  }

  /** Applique une seule proposition, depuis son dialog de détail. */
  async function applyOne(id: number) {
    await request(`/api/proposals/${id}/accept`, { method: 'POST' })
    await load()
  }

  async function refuse(id: number) {
    await request(`/api/proposals/${id}/refuse`, { method: 'POST' })
    await load()
  }

  /** La cloche compte les décisions, pas les lignes. */
  const pendingCount = computed(() => groups.value.length)

  return {
    pending,
    groups,
    decided,
    selected,
    loaded,
    pendingCount,
    load,
    toggle,
    applySelected,
    applyOne,
    refuse,
  }
})
