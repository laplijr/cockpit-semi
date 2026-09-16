export interface PlanSession {
  id: number
  weekId: number
  date: string
  sport: string
  code: string
  key: boolean
  status: string
  prescription: {
    label: string
    totalDistanceM: number
    expectedRpe: number
    steps: {
      label: string
      repeats?: number
      distanceM?: number
      durationS?: number
      paceSecPerKm?: number
      recoveryS?: number
    }[]
  }
}

export interface PlanWeekRow {
  id: number
  index: number
  startDate: string
  endDate: string
  phaseType: string
  raceId: number | null
  targetRunM: number
  longRunMaxM: number
  light: boolean
  comebackRatio: number | null
}

export interface PlanPhaseRow {
  id: number
  type: string
  startWeek: number
  endWeek: number
  raceId: number | null
}

export interface ActivePlan {
  version: { id: number; startDate: string; trigger: string; parameters: Record<string, unknown> }
  phases: PlanPhaseRow[]
  weeks: PlanWeekRow[]
  sessions: PlanSession[]
}

export interface OpenPause {
  id: number
  type: string
  zone: string | null
  startDate: string
  estimatedEndDate: string | null
  day: number
  allowances: {
    running: boolean
    cycling: boolean
    upperBodyStrength: boolean
    legStrength: boolean
    conditions?: string[]
  }
  watchZones: string[]
  notes: string | null
}

export interface PlanPayload {
  today: string
  watchZones: string[]
  plan: ActivePlan | null
  pause: OpenPause | null
  todaySessions: PlanSession[]
}

export const usePlanStore = defineStore('plan', () => {
  const payload = ref<PlanPayload>()
  const pending = ref(false)
  /** Transmet le cookie de session pendant le rendu serveur. */
  const request = useRequestFetch()

  async function load() {
    pending.value = true
    try {
      payload.value = await request<PlanPayload>('/api/plan')
    } finally {
      pending.value = false
    }
  }

  async function markResumption() {
    await request('/api/pause/resume', { method: 'POST' })
    await load()
  }

  const today = computed(() => payload.value?.today ?? '')
  const plan = computed(() => payload.value?.plan ?? null)
  const pause = computed(() => payload.value?.pause ?? null)
  const todaySessions = computed(() => payload.value?.todaySessions ?? [])
  /** Zones à surveiller héritées de la dernière pause, même refermée (§ 0). */
  const lastWatchZones = computed(() => payload.value?.watchZones ?? [])

  const currentWeek = computed(() =>
    plan.value?.weeks.find((week) => week.startDate <= today.value && today.value <= week.endDate),
  )

  const sessionsByWeek = computed(() => {
    const map = new Map<number, PlanSession[]>()
    for (const session of plan.value?.sessions ?? []) {
      const list = map.get(session.weekId) ?? []
      list.push(session)
      map.set(session.weekId, list)
    }
    return map
  })

  const tomorrowSessions = computed(() => {
    if (!today.value) return []
    const tomorrow = new Date(Date.parse(today.value) + 86_400_000).toISOString().slice(0, 10)
    return plan.value?.sessions.filter((session) => session.date === tomorrow) ?? []
  })

  return {
    payload,
    pending,
    load,
    markResumption,
    today,
    plan,
    pause,
    todaySessions,
    lastWatchZones,
    tomorrowSessions,
    currentWeek,
    sessionsByWeek,
  }
})
