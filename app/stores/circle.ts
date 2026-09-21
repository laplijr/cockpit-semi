export interface CircleIdentityView {
  id: number
  firstName: string | null
  avatar: string | null
}

export interface CirclePostView {
  id: number
  athleteId: number
  source: 'seance' | 'course'
  sport: string
  code: string | null
  date: string
  label: string | null
  distanceM: number | null
  durationMin: number | null
  note: string | null
  publishedAt: string
  bravos: CircleIdentityView[]
  mine: boolean
  comments: number
}

interface CircleWeekView {
  week: { from: string; to: string }
  today: string
  isCurrent: boolean
  previous: string
  next: string | null
  me: number
  members: CircleIdentityView[]
  authors: CircleIdentityView[]
  posts: CirclePostView[]
}

/**
 * Le cercle, une semaine à la fois (§ 8, P9). Il n'y a pas de flux à faire
 * défiler : c'est l'axe qui borne la lecture, et la semaine à venir n'existe
 * pas — on ne publie que du passé.
 */
export const useCircleStore = defineStore('circle', () => {
  const view = ref<CircleWeekView>()
  const from = ref<string>()
  const request = useRequestFetch()

  async function load(weekFrom?: string) {
    from.value = weekFrom ?? from.value
    view.value = await request<CircleWeekView>('/api/circle', {
      query: from.value ? { semaine: from.value } : undefined,
    })
    from.value = view.value.week.from
  }

  async function go(weekFrom: string) {
    await load(weekFrom)
  }

  /** Bravo est une bascule : la tuile se met à jour sans recharger la semaine. */
  async function toggleBravo(postId: number) {
    const { mine } = await $fetch<{ mine: boolean }>(`/api/circle/posts/${postId}/bravo`, {
      method: 'POST',
    })

    const post = view.value?.posts.find((one) => one.id === postId)
    const me = view.value?.members.find((one) => one.id === view.value?.me)
    if (!post || !me) return

    post.mine = mine
    post.bravos = mine
      ? [...post.bravos, me]
      : post.bravos.filter((one) => one.id !== view.value?.me)
  }

  const posts = computed(() => view.value?.posts ?? [])
  const members = computed(() => view.value?.members ?? [])

  /** Membres et anciens membres : un prénom reste sur ce qu'il a publié. */
  const authorsById = computed(
    () => new Map([...members.value, ...(view.value?.authors ?? [])].map((one) => [one.id, one])),
  )

  /** Les jours de la semaine qui portent quelque chose, du plus récent au plus ancien. */
  const days = computed(() => [...new Set(posts.value.map((post) => post.date))])

  return { view, posts, members, authorsById, days, load, go, toggleBravo }
})
