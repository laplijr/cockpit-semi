<script setup lang="ts">
import { FIX_TOLERANCE } from '~~/server/domain/tracking/fix'
import { paceGap, paceOffBand, stepRemaining } from '~~/server/domain/tracking/steps'
import type { StepTarget } from '~~/server/domain/tracking/steps'
import { averagePace, offTrackM, type Split } from '~~/server/domain/tracking/track'

/**
 * L'écran de course, hors coque (§ 9, P10). Ni barre du bas ni fil d'Ariane :
 * il n'y a rien à naviguer quand on court. Un seul grand chiffre — ce qui
 * reste de l'étape — parce que c'est la seule décision du moment.
 */
definePageMeta({ layout: false })

const route = useRoute()
const plan = usePlanStore()
const tracker = useRunTracker()

const asked = Number(route.query.seance)
/**
 * Sans séance, c'est une sortie libre (§ 9, P10.3) : on court sans rien à
 * suivre, et l'écriture la rattache ou la classe hors plan, comme avant.
 */
const sessionId = Number.isInteger(asked) && asked > 0 ? asked : null
const free = computed(() => sessionId === null)

/** Sortie déjà ouverte qu'on rejoint, et bilan à rouvrir après un échec réseau. */
const resuming = route.query.reprise === '1'
const toBilan = route.query.bilan === '1'

const { data: brief, error: briefError } = await useFetch(`/api/sessions/${sessionId}/steps`, {
  immediate: sessionId !== null,
})

/** Boucle déjà tracée pour la séance : elle sert de repère sous la trace. */
const { data: routes, refresh: refreshRoutes } = useFetch(`/api/sessions/${sessionId}/routes`, {
  lazy: true,
  server: false,
  immediate: sessionId !== null,
})

onMounted(() => plan.ensureLoaded())

const ors = useRoutingAvailable()

/** Une boucle se trace à une distance : une séance en durée n'en a pas. */
const loopable = computed(
  () => (brief.value?.totalDistanceM ?? session.value?.prescription.totalDistanceM ?? 0) > 0,
)

const loopError = ref('')
const tilesReady = ref(false)

/**
 * Tracer la boucle depuis l'écran de préparation (§ 9, P10.3) : sans
 * itinéraire, l'écart à la trace n'est jamais calculé pendant la sortie.
 */
async function traceLoop() {
  loopError.value = ''
  try {
    await $fetch(`/api/sessions/${sessionId}/routes`, { method: 'POST', body: { address: null } })
    await refreshRoutes()
  } catch (cause) {
    loopError.value = apiMessage(cause, 'Boucle impossible à tracer.')
  }
}

/**
 * Garder la carte avant de partir (§ 9, P10.3) : sans réseau, les tuiles ne
 * se chargent plus et la carte est grise. Quelques dizaines de tuiles au zoom
 * utile, demandées une fois — le navigateur les garde dans son cache HTTP —
 * et bornées pour rester dans les limites d'usage d'OpenStreetMap.
 */
const TILE_ZOOM = 15
const MAX_TILES = 64

function tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom)
}

function tileY(lat: number, zoom: number): number {
  const radians = (lat * Math.PI) / 180
  const merc = Math.log(Math.tan(radians) + 1 / Math.cos(radians))
  return Math.floor(((1 - merc / Math.PI) / 2) * 2 ** zoom)
}

async function keepTiles(points: { lat: number; lon: number }[]) {
  if (points.length === 0 || tilesReady.value) return

  const xs = points.map((point) => tileX(point.lon, TILE_ZOOM))
  const ys = points.map((point) => tileY(point.lat, TILE_ZOOM))
  const urls: string[] = []

  /** Une tuile de marge autour de la boîte : la trace passe rarement au centre. */
  for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + 1; x += 1) {
    for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y += 1) {
      urls.push(`https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`)
    }
  }

  await Promise.all(
    urls.slice(0, MAX_TILES).map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image()
          image.onload = () => resolve()
          image.onerror = () => resolve()
          image.src = url
        }),
    ),
  )

  tilesReady.value = true
}

const started = ref(false)
const stepIndex = ref(0)
const stepSince = ref({ distanceM: 0, elapsedS: 0 })
const finishError = ref('')

const session = computed(() =>
  sessionId === null
    ? undefined
    : (plan.plan?.sessions ?? []).find((item) => item.id === sessionId),
)
/**
 * Le vélo prend le même écran, avec une vitesse au lieu d'une allure (§ 9,
 * P10.3). Sa séance n'a pas d'étapes structurées : il n'y a rien à décompter,
 * on roule et on enregistre.
 */
const cycling = computed(() => session.value?.sport === 'velo')

/** Le filtre des relevés suit le sport : sinon une descente est jetée (P10.3). */
watch(cycling, (riding) => {
  tracker.speedLimitMS.value = riding ? FIX_TOLERANCE.cyclingMaxSpeedMS : FIX_TOLERANCE.maxSpeedMS
})

const targets = computed<StepTarget[]>(() => brief.value?.targets ?? [])
const target = computed<StepTarget | undefined>(() => targets.value[stepIndex.value])
const guide = computed(() => routes.value?.routes[0]?.points ?? [])

/** La boucle connue, les tuiles partent avec : c'est le seul moment tranquille. */
watch(
  () => guide.value,
  (points) => {
    if (points.length > 1) void keepTiles(points)
  },
  { immediate: true },
)

const distanceM = computed(() => tracker.track.value.distanceM)
const elapsedS = computed(() => tracker.track.value.elapsedS)
const average = computed(() => averagePace(tracker.track.value))

const mark = computed(() => ({ distanceM: distanceM.value, elapsedS: elapsedS.value }))

const remaining = computed(() =>
  target.value ? stepRemaining(target.value, stepSince.value, mark.value) : null,
)

/** Le grand chiffre : ce qui reste de l'étape, en temps ou en distance. */
const stepLeft = computed(() => {
  const value = remaining.value
  if (value?.remainingS !== null && value?.remainingS !== undefined) {
    return formatDuration(value.remainingS)
  }
  if (value?.remainingM !== null && value?.remainingM !== undefined) {
    return formatDistance(value.remainingM)
  }
  return '—'
})

const gap = computed(() => (target.value ? paceGap(target.value, tracker.pace.value) : null))
const offBand = computed(() => paceOffBand(gap.value))

const offTrack = computed(() => {
  const position = tracker.position.value
  if (!position || guide.value.length < 2) return false
  const away = offTrackM(position, guide.value)
  return away !== null && away > FIX_TOLERANCE.offTrackM
})

/** Trop court pour être une séance : l'abandon passe devant l'enregistrement. */
const tooShort = computed(() => distanceM.value < FIX_TOLERANCE.minRunM)

/** Étape franchie : la suivante prend la main, et s'annonce. */
watch(remaining, (value) => {
  if (value?.complete) nextStep()
})

function nextStep() {
  if (stepIndex.value >= targets.value.length - 1) return
  stepIndex.value += 1
  stepSince.value = { ...mark.value }

  const next = targets.value[stepIndex.value]
  if (next) tracker.announce(`${next.label}, ${describeTarget(next)}`)
}

function describeTarget(step: StepTarget): string {
  if (step.durationS) return formatMinutes(step.durationS / 60)
  if (step.distanceM) return formatDistance(step.distanceM)
  return 'à la sensation'
}

/**
 * Ce qu'il y a à tenir sur l'étape. Une récupération ne porte ni allure ni
 * effort : elle ne dit que sa durée, et « à RPE — » n'aurait rien dit.
 */
function targetLine(step: StepTarget): string {
  if (step.paceSecPerKm) return `${describeTarget(step)} à ${formatPace(step.paceSecPerKm)}/km`
  if (step.rpe) return `${describeTarget(step)} à RPE ${step.rpe}`
  return describeTarget(step)
}

/** Barre d'un split : le kilomètre le plus rapide fait la largeur pleine. */
function splitWidth(seconds: number, all: Split[]): number {
  const fastest = Math.min(...all.map((split) => split.seconds))
  return Math.round((fastest / seconds) * 100)
}

async function start() {
  started.value = true
  await tracker.start(sessionId)
  /** Rien à courir : la sortie était finie, il ne manquait que l'enregistrement. */
  if (toBilan) await tracker.stop()
}

async function abandon() {
  if (tracker.runId.value !== null) {
    await $fetch(`/api/runs/${tracker.runId.value}/abandon`, { method: 'POST' })
  }
  tracker.forget()
  await navigateTo('/')
}

/** Une seule requête pour la trace et le ressenti : la sortie s'enregistre d'un coup. */
async function record(payload: {
  rpe: number
  sensations: string[]
  sleepHours: number | null
  pain: { zone: string; intensity: number } | null
  durationMin: number
  distanceM: number | null
  notes: string | null
}) {
  finishError.value = ''
  const measuredMin = Math.round(elapsedS.value / 60)

  try {
    await $fetch(`/api/runs/${tracker.runId.value}/finish`, {
      method: 'POST',
      body: {
        fixes: tracker.fixes.value,
        rpe: payload.rpe,
        sensations: payload.sensations,
        sleepHours: payload.sleepHours,
        pain: payload.pain,
        notes: payload.notes,
        correctedDistanceM:
          payload.distanceM !== null && payload.distanceM !== distanceM.value
            ? payload.distanceM
            : null,
        correctedDurationMin: payload.durationMin === measuredMin ? null : payload.durationMin,
      },
    })

    tracker.forget()
    await plan.load()
    await navigateTo('/')
  } catch (cause) {
    finishError.value = apiMessage(cause, 'Enregistrement impossible.')
    throw cause
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col gap-3 bg-ink px-4 pt-3 pb-4">
    <p v-if="briefError && !cycling && !free" class="tile text-[13px] text-warn">
      Cette séance ne se court pas depuis le cockpit.
      <NuxtLink to="/" class="text-accent">Retour au cockpit</NuxtLink>
    </p>

    <!-- 1 · Préparation : les étapes, la boucle, et le seul geste qui demande
         les autorisations — écran allumé, position, voix. -->
    <template v-else-if="!started">
      <NuxtLink
        to="/"
        class="tap -ml-2 inline-flex h-11 items-center gap-2 px-2 text-[13px] text-text-dim"
      >
        <UiAppIcon name="chevron" :size="18" class="rotate-180" />
        Retour au cockpit
      </NuxtLink>

      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <UiAppIcon
          :name="cycling ? 'velo' : 'run'"
          :size="20"
          class="self-center"
          :class="cycling ? 'text-cycling' : 'text-accent'"
        />
        <h1 class="display text-[28px] font-semibold">
          {{ free ? 'Sortie libre' : (brief?.label ?? session?.prescription.label ?? 'Sortie') }}
        </h1>
        <span v-if="brief?.key" class="pill bg-accent/15 text-accent">clé</span>
        <span v-if="brief" class="mono w-full text-[11.5px] text-text-dim">
          {{ formatLongDate(brief.date) }} · {{ formatDistance(brief.totalDistanceM) }} ·
          {{ formatMinutes(brief.totalDurationS / 60) }}
        </span>
        <span v-else-if="free" class="mono w-full text-[11.5px] text-text-dim">
          Hors plan · ni étape ni allure à tenir
        </span>
        <span v-else-if="cycling" class="mono w-full text-[11.5px] text-text-dim">
          {{ formatLongDate(session!.date) }} ·
          {{ formatMinutes(session!.prescription.durationMin) }}
        </span>
      </div>

      <div v-if="targets.length > 0" class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Étapes</span>
        <div
          v-for="(step, index) in targets"
          :key="`${step.label}-${index}`"
          class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
        >
          <span class="flex-1 text-[13px]">{{ step.label }}</span>
          <span class="mono text-[12px] text-text-dim">{{ targetLine(step) }}</span>
        </div>
      </div>

      <!-- L'écart à la trace ne se calcule que si une boucle existe : elle se
           trace donc ici, avant de partir (§ 9, P10.3). -->
      <div v-if="!free && (guide.length > 1 || (ors && loopable))" class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Itinéraire</span>

        <template v-if="guide.length > 1">
          <ClientOnly>
            <UiRouteMap :points="guide" :height="190" />
            <template #fallback>
              <UiSkeleton variant="block" :height="190" class="rounded-md" />
            </template>
          </ClientOnly>
          <span class="mono text-[11.5px]" :class="tilesReady ? 'text-text-dim' : 'text-warn'">
            <template v-if="tilesReady">Carte gardée pour le hors-réseau</template>
            <template v-else>Carte à garder avant de partir</template>
          </span>
        </template>

        <template v-else>
          <p class="text-[12.5px] text-text-dim">
            Aucune boucle pour cette séance : sans elle, l'écart à la trace ne se calcule pas.
          </p>
          <UiActionButton class="btn btn-ghost" :action="traceLoop">
            <UiAppIcon name="route" :size="15" />
            Tracer une boucle
          </UiActionButton>
          <p v-if="loopError" class="text-[12px] text-warn">{{ loopError }}</p>
        </template>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Avant de partir</span>
        <p class="text-[12.5px] text-text-dim">
          L'écran reste allumé pendant la sortie : le navigateur ne sait pas suivre le GPS en
          arrière-plan.
        </p>
        <label class="flex min-h-11 items-center gap-[10px] text-[13px]">
          <input v-model="tracker.announcing.value" type="checkbox" class="size-5 accent-accent" />
          Annonces vocales à chaque kilomètre et à chaque étape
        </label>
      </div>

      <UiActionButton class="btn btn-lg mt-auto" :action="start">
        <template v-if="toBilan">Reprendre l'enregistrement</template>
        <template v-else-if="resuming">Reprendre la sortie</template>
        <template v-else>Démarrer</template>
      </UiActionButton>
    </template>

    <!-- 2 · Acquisition : le chrono attend une position digne de ce nom. -->
    <template v-else-if="tracker.phase.value === RunPhase.Acquisition">
      <div class="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span class="display text-[26px] font-semibold">Recherche du signal</span>
        <span class="mono text-[15px] text-warn">
          <template v-if="tracker.accuracyM.value === null">signal absent</template>
          <template v-else>précision {{ Math.round(tracker.accuracyM.value) }} m</template>
        </span>
        <p class="max-w-[280px] text-[12.5px] text-text-dim">
          Le chrono part dès que la précision passe sous {{ FIX_TOLERANCE.startAccuracyM }} m. Rien
          n'est compté avant : une dérive au départ fabriquerait de la distance qui n'existe pas.
        </p>
        <p v-if="tracker.error.value" class="text-[13px] text-warn">{{ tracker.error.value }}</p>
      </div>

      <button type="button" class="btn btn-ghost btn-lg" @click="tracker.startAnyway">
        Démarrer quand même
      </button>
      <UiActionButton class="btn btn-ghost" :action="abandon"> Annuler </UiActionButton>
    </template>

    <!-- 4 · Pause : chiffres figés, GPS coupé, trois issues. -->
    <template v-else-if="tracker.phase.value === RunPhase.Paused">
      <div class="flex items-center gap-3">
        <span class="flex-1 text-[13.5px]">
          {{ brief?.label }} · étape {{ stepIndex + 1 }} / {{ targets.length }}
        </span>
        <span class="pill pill-warn">en pause</span>
      </div>

      <div class="flex flex-1 flex-col items-center justify-center gap-1">
        <span class="label text-[10.5px]">Temps de la sortie</span>
        <span class="display text-[80px] leading-none font-bold text-text-dim">
          {{ formatDuration(elapsedS) }}
        </span>
        <span class="mono text-[14px] text-text-dim">
          {{ formatDistance(distanceM) }}
          <template v-if="average">
            · <template v-if="cycling">{{ formatSpeed(average) }}</template>
            <template v-else>{{ formatPace(average) }}/km</template>
          </template>
        </span>
        <p class="mt-3 max-w-[280px] text-center text-[12.5px] text-text-dim">
          Le GPS est coupé : la pause ne fabrique ni distance ni dérive.
        </p>
      </div>

      <button type="button" class="btn btn-lg" @click="tracker.resumeRun">Reprendre</button>
      <UiActionButton class="btn btn-ghost" :action="tracker.stop">
        Terminer la sortie
      </UiActionButton>
      <UiActionButton class="btn btn-ghost" :action="abandon">
        Abandonner — rien ne sera enregistré
      </UiActionButton>
    </template>

    <!-- 5 · Bilan et ressenti : une seule action, et elle enregistre tout. -->
    <template v-else-if="tracker.phase.value === RunPhase.Done">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="display text-[28px] font-semibold">Sortie terminée</h1>
        <span class="mono w-full text-[11.5px] text-text-dim">
          <template v-if="brief?.label">{{ brief.label }} · </template>
          <template v-else-if="free">Hors plan · </template>
          {{ formatDistance(distanceM) }} · {{ formatDuration(elapsedS) }}
        </span>
      </div>

      <div v-if="tooShort" class="tile bg-surface-inset">
        <p class="text-[13px] text-warn">
          Moins de {{ formatDistance(FIX_TOLERANCE.minRunM) }} : ce n'est pas une séance, et ça
          fausserait la charge.
        </p>
        <UiActionButton class="btn" :action="abandon">Abandonner la sortie</UiActionButton>
        <button type="button" class="btn btn-ghost" @click="tracker.resumeRun">Reprendre</button>
      </div>

      <template v-else>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Splits</span>
          <div
            v-for="split in tracker.kilometres.value"
            :key="split.km"
            class="flex items-center gap-3"
          >
            <span class="mono w-[34px] text-[11.5px] text-text-dim">km {{ split.km }}</span>
            <span class="h-2 flex-1 rounded-sm bg-surface-muted">
              <span
                class="block h-2 rounded-sm bg-accent"
                :style="{ width: `${splitWidth(split.seconds, tracker.kilometres.value)}%` }"
              />
            </span>
            <span class="mono w-[42px] text-right text-[12px]">{{
              formatPace(split.seconds)
            }}</span>
          </div>
          <p v-if="tracker.kilometres.value.length === 0" class="text-[12.5px] text-text-dim">
            Moins d'un kilomètre.
          </p>
        </div>

        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Trace</span>
          <ClientOnly>
            <UiRouteMap :points="tracker.track.value.points" :guide="guide" :height="190" />
          </ClientOnly>
          <span class="mono text-[12px] text-text-dim">
            {{ formatDistance(distanceM) }} · D+ environ {{ tracker.track.value.elevationGainM }} m
          </span>
        </div>

        <!-- Une sortie libre n'a pas de séance : le formulaire s'en passe et
             l'enregistrement, lui, ne change pas (§ 9, P10.3). -->
        <FeedbackForm
          v-if="session || free"
          :session="session"
          :watch-zones="plan.lastWatchZones"
          :measured="{ durationMin: Math.round(elapsedS / 60), distanceM }"
          :submit="record"
          action="Enregistrer"
        />
        <p v-else class="text-[13px] text-text-dim">
          Séance introuvable : le plan n'est pas chargé.
        </p>

        <p v-if="finishError" class="text-[13px] text-warn">{{ finishError }}</p>
      </template>
    </template>

    <!-- 3 · En course : le grand chiffre, l'écart d'allure, la trace. -->
    <template v-else>
      <div class="flex items-center gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="text-[13.5px]">
            <template v-if="targets.length > 0">
              {{ brief?.label }} · étape {{ stepIndex + 1 }} / {{ targets.length }}
            </template>
            <template v-else-if="cycling">{{ session?.prescription.label }}</template>
            <template v-else>Sortie libre</template>
          </span>
          <span class="mono truncate text-[11.5px] text-text-dim">
            <template v-if="target">{{ target.label }} · {{ targetLine(target) }}</template>
          </span>
        </div>
        <button
          v-if="targets.length > 0"
          type="button"
          class="btn btn-ghost size-11 shrink-0 p-0"
          aria-label="Passer à l'étape suivante"
          @click="nextStep"
        >
          <UiAppIcon name="chevron" :size="18" />
        </button>
      </div>

      <div class="flex gap-[3px]">
        <span
          v-for="(step, index) in targets"
          :key="`bar-${index}`"
          class="h-1 flex-1 rounded-sm"
          :class="
            index < stepIndex
              ? 'bg-accent-track'
              : index === stepIndex
                ? 'bg-accent'
                : 'bg-surface-muted'
          "
        />
      </div>

      <div class="flex flex-col items-center gap-1 pt-3 pb-1">
        <!-- Sans étape à décompter — sortie libre ou vélo — le grand chiffre
             est le temps de la sortie : c'est ce qu'on regarde (§ 8, P10.3). -->
        <span class="label text-[10.5px]">
          {{ targets.length > 0 ? 'Reste sur l’étape' : 'Temps de la sortie' }}
        </span>
        <span class="display text-[80px] leading-[0.95] font-bold">
          {{ targets.length > 0 ? stepLeft : formatDuration(elapsedS) }}
        </span>
        <span v-if="target" class="mono text-[14px] text-text-dim">
          cible {{ targetLine(target) }}
        </span>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 border-y border-line-soft py-3">
        <span class="mono text-[30px]" :class="offBand ? 'text-warn' : 'text-text'">
          <template v-if="cycling">{{ formatSpeed(tracker.pace.value) }}</template>
          <template v-else>{{ formatPace(tracker.pace.value) }}</template>
        </span>
        <span v-if="!cycling" class="mono text-[13px] text-text-dim">/km</span>
        <span v-if="gap !== null && offBand" class="pill pill-warn">
          {{ gap > 0 ? '+' : '−' }} {{ Math.abs(gap) }} s sur la cible
        </span>
        <span v-if="tracker.lost.value" class="pill pill-warn">signal perdu</span>
        <span v-else-if="offTrack" class="pill pill-warn">hors trace</span>
      </div>

      <div class="flex justify-between gap-3">
        <span class="flex flex-col">
          <span class="mono text-[20px]">{{ formatDistance(distanceM) }}</span>
          <span class="label text-[9.5px]">distance</span>
        </span>
        <span class="flex flex-col">
          <span class="mono text-[20px]">{{ formatDuration(elapsedS) }}</span>
          <span class="label text-[9.5px]">temps</span>
        </span>
        <span class="flex flex-col">
          <span class="mono text-[20px]">
            <template v-if="!average">—</template>
            <template v-else-if="cycling">{{ formatSpeed(average) }}</template>
            <template v-else>{{ formatPace(average) }}/km</template>
          </span>
          <span class="label text-[9.5px]">{{ cycling ? 'vitesse moy.' : 'allure moy.' }}</span>
        </span>
      </div>

      <ClientOnly>
        <UiRouteMap
          :points="tracker.track.value.points"
          :guide="guide"
          :position="tracker.position.value"
          :height="190"
        />
      </ClientOnly>

      <div class="mt-auto flex flex-col gap-[10px]">
        <button type="button" class="btn btn-lg h-[52px]" @click="tracker.pauseRun">
          <UiAppIcon name="pause" :size="18" />
          Pause
        </button>
        <UiActionButton class="btn btn-ghost" :action="tracker.stop">Terminer</UiActionButton>
      </div>
    </template>
  </div>
</template>
