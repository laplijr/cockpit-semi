import { FIX_TOLERANCE, type GeoFix } from '~~/server/domain/tracking/fix'
import { measureTrack, smoothedPace, splits, type Track } from '~~/server/domain/tracking/track'

/**
 * La capture d'une sortie dans le navigateur (§ 9, P10). Le suivi n'existe que
 * l'écran allumé : ni iOS ni Android ne laissent un onglet lire le GPS en
 * arrière-plan, et un service worker n'y changerait rien. La trace vit donc
 * d'abord dans l'appareil, et un point de reprise régulier la met à l'abri.
 */

export enum RunPhase {
  Acquisition = 'acquisition',
  Running = 'course',
  Paused = 'pause',
  Done = 'bilan',
}

/** Intervalle entre deux dépôts de la trace au serveur. */
const CHECKPOINT_MS = 120_000

/** Clé de la trace en cours dans l'appareil : une sortie à la fois. */
const STORAGE_KEY = 'cockpit.run'

export interface StoredTrack {
  runId: number
  sessionId: number | null
  fixes: GeoFix[]
  /** Vrai quand la sortie est finie mais pas encore enregistrée (§ 9, P10). */
  finished: boolean
}

/**
 * La sortie que cet appareil garde. Elle sert à la ligne du jour : c'est le
 * seul endroit qui sache qu'une sortie attend son enregistrement.
 */
export function storedRun(): StoredTrack | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : (JSON.parse(raw) as StoredTrack)
  } catch {
    return null
  }
}

export function useRunTracker() {
  const phase = ref<RunPhase>(RunPhase.Acquisition)
  const runId = ref<number | null>(null)
  const fixes = ref<GeoFix[]>([])
  const accuracyM = ref<number | null>(null)
  const lost = ref(false)
  const announcing = ref(true)
  const error = ref('')

  /**
   * Vitesse plausible : la course par défaut, le vélo quand l'écran le dit
   * (§ 9, P10.3). Sans ça, une descente à vélo passerait pour un saut.
   */
  const speedLimitMS = ref<number>(FIX_TOLERANCE.maxSpeedMS)

  const track = computed<Track>(() => measureTrack(fixes.value, speedLimitMS.value))
  const pace = computed(() => smoothedPace(track.value))
  const kilometres = computed(() => splits(track.value))
  const position = computed(() => track.value.points.at(-1) ?? null)

  let watchId: number | null = null
  let wakeLock: WakeLockSentinel | null = null
  let checkpointTimer: ReturnType<typeof setInterval> | null = null
  let lastSent = 0
  let announced = 0
  const sessionOf = ref<number | null>(null)

  function remember(finished = false) {
    try {
      if (runId.value === null) return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          runId: runId.value,
          sessionId: sessionOf.value,
          fixes: fixes.value,
          finished,
        } satisfies StoredTrack),
      )
    } catch {
      /** Navigation privée, stockage refusé : la sortie tient quand même. */
    }
  }

  function forget() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /** Rien à faire : la clé sera écrasée à la prochaine sortie. */
    }
  }

  /** Une annonce ne s'entend que si la voix a été débloquée par un geste. */
  function announce(text: string) {
    if (!announcing.value || typeof speechSynthesis === 'undefined') return
    speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  }

  async function keepScreenOn() {
    try {
      wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      /** Refusé ou absent : l'écran s'éteindra, et la sortie s'arrêtera avec lui. */
    }
  }

  function onPosition(reading: GeolocationPosition) {
    accuracyM.value = reading.coords.accuracy
    lost.value = false

    if (phase.value === RunPhase.Acquisition) {
      if (reading.coords.accuracy > FIX_TOLERANCE.startAccuracyM) return
      phase.value = RunPhase.Running
    }

    if (phase.value !== RunPhase.Running) return

    fixes.value = [
      ...fixes.value,
      {
        lat: reading.coords.latitude,
        lon: reading.coords.longitude,
        elevationM: reading.coords.altitude ?? undefined,
        accuracyM: reading.coords.accuracy,
        at: reading.timestamp,
      },
    ]

    remember()
    announceKilometre()
  }

  function announceKilometre() {
    const last = kilometres.value.at(-1)
    if (last === undefined || last.km === announced) return

    announced = last.km
    vibrate(200)
    announce(`Kilomètre ${last.km}, ${formatPace(last.seconds)}`)
  }

  function watch() {
    if (watchId !== null || typeof navigator === 'undefined') return

    watchId = navigator.geolocation.watchPosition(onPosition, () => (lost.value = true), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    })
  }

  function unwatch() {
    if (watchId === null) return
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  /** Dépôt de ce que le serveur n'a pas encore : le reste y est déjà. */
  async function checkpoint() {
    if (runId.value === null || fixes.value.length === lastSent) return

    const sending = fixes.value.length
    try {
      await $fetch(`/api/runs/${runId.value}/checkpoint`, {
        method: 'POST',
        body: { fixes: fixes.value.slice(lastSent) },
      })
      lastSent = sending
    } catch {
      /** Le réseau reviendra ; la trace est dans l'appareil en attendant. */
    }
  }

  /**
   * Départ. Les trois autorisations se demandent ici, sur le geste : l'écran
   * allumé, la position, et la voix — qu'iOS ne débloque pas autrement.
   */
  async function start(sessionId: number | null) {
    error.value = ''
    sessionOf.value = sessionId
    announce('Sortie lancée')
    await keepScreenOn()

    try {
      const opened = await $fetch<{ id: number }>('/api/runs', {
        method: 'POST',
        body: { sessionId, date: new Date().toISOString().slice(0, 10) },
      })
      runId.value = opened.id

      /** Sortie retrouvée : ses relevés sont ceux de l'appareil, plus complets. */
      const stored = storedRun()
      if (stored !== null && stored.runId === opened.id) {
        fixes.value = stored.fixes
        announced = stored.fixes.length > 0 ? splits(measureTrack(stored.fixes)).length : 0
      }
    } catch (cause) {
      error.value = apiMessage(cause, 'Sortie impossible à ouvrir.')
      return
    }

    phase.value = fixes.value.length > 0 ? RunPhase.Running : RunPhase.Acquisition
    watch()
    checkpointTimer = setInterval(checkpoint, CHECKPOINT_MS)
  }

  /** Démarrage forcé : on part sans attendre une précision qui ne vient pas. */
  function startAnyway() {
    if (phase.value === RunPhase.Acquisition) phase.value = RunPhase.Running
  }

  function pauseRun() {
    phase.value = RunPhase.Paused
    unwatch()
    announce('Pause')
  }

  function resumeRun() {
    phase.value = RunPhase.Running
    watch()
    announce('Reprise')
  }

  async function stop() {
    unwatch()
    if (checkpointTimer !== null) clearInterval(checkpointTimer)
    checkpointTimer = null
    await checkpoint()
    await wakeLock?.release()
    wakeLock = null
    phase.value = RunPhase.Done
    /** Finie mais pas enregistrée : la ligne du jour doit pouvoir le dire. */
    remember(true)
  }

  onBeforeUnmount(() => {
    unwatch()
    if (checkpointTimer !== null) clearInterval(checkpointTimer)
    void wakeLock?.release()
  })

  return {
    speedLimitMS,
    phase,
    runId,
    fixes,
    track,
    pace,
    kilometres,
    position,
    accuracyM,
    lost,
    announcing,
    error,
    start,
    startAnyway,
    pauseRun,
    resumeRun,
    stop,
    announce,
    forget,
  }
}
