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

export const usePropositionsStore = defineStore('proposals', () => {
  const pending = ref<ProposalRow[]>([])
  const decided = ref<ProposalRow[]>([])
  const selected = ref<number[]>([])
  const request = useRequestFetch()

  async function load() {
    const payload = await request<{ pending: ProposalRow[]; decided: ProposalRow[] }>(
      '/api/proposals',
    )
    pending.value = payload.pending
    decided.value = payload.decided
    selected.value = selected.value.filter((id) => payload.pending.some((row) => row.id === id))
  }

  function toggle(id: number) {
    const index = selected.value.indexOf(id)
    if (index === -1) selected.value.push(id)
    else selected.value.splice(index, 1)
  }

  /** Applique les propositions cochées, une par une, puis recharge. */
  async function applySelected() {
    for (const id of [...selected.value]) {
      await request(`/api/proposals/${id}/accept`, { method: 'POST' })
    }
    selected.value = []
    await load()
  }

  /** Applique une seule proposition, depuis son panneau de détail. */
  async function applyOne(id: number) {
    await request(`/api/proposals/${id}/accept`, { method: 'POST' })
    await load()
  }

  async function refuse(id: number) {
    await request(`/api/proposals/${id}/refuse`, { method: 'POST' })
    await load()
  }

  const pendingCount = computed(() => pending.value.length)

  return { pending, decided, selected, pendingCount, load, toggle, applySelected, applyOne, refuse }
})
