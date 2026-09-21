import { pendingNotices, type NoticeKind, type NoticeState } from '~/utils/notices'

/**
 * Préférence de rappel, par navigateur et non par compte : la permission est
 * celle de cet appareil, la préférence la suit. Elle peut revenir vide — la
 * navigation privée, un stockage bloqué — et le cockpit marche sans.
 */
const STORAGE_KEY = 'cockpit:notices'

interface Stored {
  enabled: boolean
  lastNotified: Partial<Record<NoticeKind, string>>
}

const EMPTY: Stored = { enabled: false, lastNotified: {} }

/**
 * Les rappels du navigateur (§ 9, P7.2). Sans service worker, l'API ne parle
 * que depuis un onglet ouvert : elle rappelle, elle ne réveille pas. Ce qui
 * se pose ici — la permission, la règle, la déduplication — est ce qu'une
 * vraie notification poussée réutilisera le jour où la PWA arrivera.
 */
export function useBrowserNotices() {
  const supported = import.meta.client && 'Notification' in window

  /**
   * État partagé et non `ref` local : l'interrupteur des réglages et le
   * composant qui envoie les rappels appellent tous deux ce composable, et
   * deux `ref` séparés laisseraient le second éteint jusqu'au rechargement.
   */
  const permission = useState<NotificationPermission>('notices-permission', () =>
    supported ? Notification.permission : 'denied',
  )
  const stored = useState<Stored>('notices-preference', read)
  const enabled = computed(() => stored.value.enabled && permission.value === 'granted')

  /** La permission ne se demande que sur un geste : refusée une fois, elle est fermée. */
  async function enable() {
    if (!supported) return
    if (permission.value === 'default') permission.value = await Notification.requestPermission()
    if (permission.value === 'granted') write({ ...stored.value, enabled: true })
  }

  function disable() {
    write({ ...stored.value, enabled: false })
  }

  /** Rend ce qui a été notifié, pour que l'appelant sache s'il s'est passé quelque chose. */
  function check(state: Omit<NoticeState, 'lastNotified'>): NoticeKind[] {
    if (!enabled.value) return []

    const notices = pendingNotices({ ...state, lastNotified: stored.value.lastNotified })
    if (notices.length === 0) return []

    const lastNotified = { ...stored.value.lastNotified }
    for (const notice of notices) {
      new Notification(notice.title, { body: notice.body, tag: notice.kind })
      lastNotified[notice.kind] = state.today
    }
    write({ ...stored.value, lastNotified })

    return notices.map((notice) => notice.kind)
  }

  function read(): Stored {
    if (!import.meta.client) return EMPTY
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Stored) } : EMPTY
    } catch {
      return EMPTY
    }
  }

  function write(next: Stored) {
    stored.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* Stockage bloqué : la préférence ne survit pas à la page, le reste marche. */
    }
  }

  return { supported, permission, enabled, enable, disable, check }
}
