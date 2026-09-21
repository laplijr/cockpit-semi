const STORAGE_KEY = 'cockpit:cercle-vu'

/**
 * Le point de non-lu du cercle (§ 8, P9). Il dit qu'il s'est passé quelque
 * chose depuis la dernière visite, et rien de plus : **un point, pas un
 * nombre** — un compteur ferait du cercle une dette à solder.
 *
 * La marque vit dans `localStorage`, comme la permission des rappels (P7.2) :
 * « vu » appartient à l'appareil sur lequel on a vu, pas au compte. Lectures
 * et écritures sous `try` — navigation privée, stockage bloqué — et le cockpit
 * marche sans.
 */
export function useCircleUnread() {
  const latest = useState<string | null>('cercle-latest', () => null)
  const seenAt = useState<string | null>('cercle-vu', () => read())
  const athlete = useAthleteStore()

  function read(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  }

  async function refresh() {
    if (!athlete.inCircle) {
      latest.value = null
      return
    }
    try {
      const { latest: at } = await $fetch<{ latest: string | null }>('/api/circle/latest')
      latest.value = at
    } catch {
      latest.value = null
    }
  }

  /** La page vue marque la date du jour : ce qui arrive après rallumera le point. */
  function markSeen() {
    const now = new Date().toISOString()
    seenAt.value = now
    try {
      localStorage.setItem(STORAGE_KEY, now)
    } catch {
      /* stockage refusé : le point restera allumé, et c'est tout. */
    }
  }

  const unread = computed(() => {
    if (!latest.value) return false
    return !seenAt.value || latest.value > seenAt.value
  })

  return { unread, refresh, markSeen }
}
