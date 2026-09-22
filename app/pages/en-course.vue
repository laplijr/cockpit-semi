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

/** Une boucle se trace à une distance : une séance en durée n'en a pas. */
const targetDistanceM = computed(
  () => brief.value?.totalDistanceM ?? session.value?.prescription.totalDistanceM ?? 0,
)

const loopable = computed(() => targetDistanceM.value > 0)

const tilesReady = ref(false)

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
/** La boucle suivie est celle que l'écran de préparation montre (§ 9, P10.3). */
const shownRoute = ref(0)

const guide = computed(() => {
  const all = routes.value?.routes ?? []
  return all.length === 0 ? [] : (all[shownRoute.value % all.length]?.points ?? [])
})

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

/**
 * L'écart se dit dans le sens où il se corrige. « − 80 s sur la cible » ne
 * disait pas si on courait trop vite ou trop lentement (§ 9, P18).
 */
const gapLine = computed(() => {
  const value = gap.value
  if (value === null || !offBand.value) return ''
  return value > 0 ? `${value} s trop lent` : `${Math.abs(value)} s plus rapide`
})

/**
 * Cible dépassée sur la dernière étape : il n'y a pas d'étape suivante pour
 * reprendre la main, et le décompte resterait à zéro. Le grand chiffre bascule
 * alors sur ce qui a été couru au-delà (§ 9, P18).
 */
const beyond = computed(
  () =>
    targets.value.length > 0 &&
    stepIndex.value === targets.value.length - 1 &&
    remaining.value?.complete === true,
)

/** Le dépassement, dans l'unité de l'étape. */
const stepOver = computed(() => {
  const value = remaining.value
  if (value?.overS !== null && value?.overS !== undefined) return `+ ${formatDuration(value.overS)}`
  if (value?.overM !== null && value?.overM !== undefined) return `+ ${formatDistance(value.overM)}`
  return '—'
})

/** Le grand chiffre de l'écran, replié comme déplié. */
const headline = computed(() => {
  if (targets.value.length === 0) return formatDuration(elapsedS.value)
  return beyond.value ? stepOver.value : stepLeft.value
})

/** Ce que le grand chiffre décompte : la seule chose qui change de sens ici. */
const headlineLabel = computed(() => {
  if (targets.value.length === 0) return 'Temps de la sortie'
  return beyond.value ? 'Au-delà de la cible' : 'Reste sur l’étape'
})

/** En course, l'écran est la carte : plus de colonne, plus de défilement. */
const immersive = computed(() => started.value && tracker.phase.value === RunPhase.Running)

/** Chiffres repliés : il ne reste qu'une ligne, et la carte prend le reste. */
const folded = ref(false)

/** La carte a été déplacée au doigt : elle ne suit plus, et le dit. */
const adrift = ref(false)
const map = useTemplateRef<{ recenter: () => void }>('map')

function recenter() {
  map.value?.recenter()
}

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

/** La cible atteinte se dit une fois : après, on court en connaissance. */
const announcedTarget = ref(false)

watch(beyond, (over) => {
  if (!over || announcedTarget.value) return
  announcedTarget.value = true
  tracker.announce(`Cible atteinte, ${speakLine(target.value!)}`)
})

function nextStep() {
  if (stepIndex.value >= targets.value.length - 1) return
  stepIndex.value += 1
  stepSince.value = { ...mark.value }

  const next = targets.value[stepIndex.value]
  if (next) tracker.announce(`${next.label}, ${speakLine(next)}`)
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

/**
 * La même étape, dite à voix haute. Ni « 8′ » ni « 4:15 » ne se lisent : la
 * synthèse vocale en fait un prime muet et des heures (§ 9, P18).
 */
function speakLine(step: StepTarget): string {
  const size = step.durationS
    ? speakDuration(step.durationS)
    : step.distanceM
      ? speakDistance(step.distanceM)
      : 'à la sensation'

  if (step.paceSecPerKm) return `${size} à ${speakPace(step.paceSecPerKm)}`
  if (step.rpe) return `${size} à RPE ${step.rpe}`
  return size
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
  <div
    :class="
      immersive
        ? 'relative h-dvh overflow-hidden bg-ink'
        : 'flex min-h-dvh flex-col gap-3 bg-ink px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]'
    "
  >
    <!-- `dvh` et non `vh` : sur un navigateur de téléphone, `100vh` est la
         hauteur barres rétractées — un document plus haut que ce qu'on voit,
         donc du vide noir sous le dernier bouton (§ 8, P7.4). Le pied garde la
         zone sûre : l'action de l'écran est poussée en bas par `mt-auto`, et
         sans elle elle tombe sur la barre d'accueil. -->
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

      <!-- L'itinéraire est le même objet que dans la fenêtre de séance : même
           composant, mêmes gestes — adresse, autre boucle, partir d'ici. Deux
           tuiles pour un même objet, c'était l'erreur (§ 8, P10.3). -->
      <template v-if="!free && loopable">
        <SessionsRouteSuggestion
          v-model:shown="shownRoute"
          compact
          :session-id="sessionId!"
          :distance-m="targetDistanceM"
          @changed="refreshRoutes"
        />
        <span
          v-if="guide.length > 1"
          class="mono -mt-1 text-[11.5px]"
          :class="tilesReady ? 'text-text-dim' : 'text-warn'"
        >
          <template v-if="tilesReady">Carte gardée pour le hors-réseau</template>
          <template v-else>Carte à garder avant de partir</template>
        </span>
      </template>

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

    <!-- 3 · En course : la carte prend l'écran, les chiffres se posent dessus,
         et les deux gestes flottent au pouce (§ 9, P18). -->
    <template v-else>
      <ClientOnly>
        <UiRouteMap
          ref="map"
          fill
          :points="tracker.track.value.points"
          :guide="guide"
          :position="tracker.position.value"
          @adrift="adrift = $event"
        />
      </ClientOnly>

      <!-- Le bandeau laisse passer le doigt, seuls ses objets le prennent :
           sinon la moitié haute de la carte serait morte sous la main. -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 z-map flex flex-col gap-3 bg-gradient-to-b from-ink from-80% to-transparent px-4 pt-3 pb-10"
      >
        <div class="pointer-events-auto flex items-center gap-3">
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
            class="btn btn-ghost size-11 shrink-0 bg-surface/95 p-0"
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
                  ? beyond
                    ? 'bg-ok'
                    : 'bg-accent'
                  : 'bg-surface-muted'
            "
          />
        </div>

        <!-- Replié, il ne reste que ce qui se lit d'un coup d'œil : la carte
             prend alors presque tout l'écran. -->
        <div v-if="folded" class="pointer-events-auto flex items-baseline gap-3">
          <span
            class="display text-[38px] leading-none font-bold"
            :class="beyond && 'text-accent'"
            >{{ headline }}</span
          >
          <span class="mono text-[17px]" :class="offBand ? 'text-warn' : 'text-text-dim'">
            <template v-if="cycling">{{ formatSpeed(tracker.pace.value) }}</template>
            <template v-else>{{ formatPace(tracker.pace.value) }}/km</template>
          </span>
          <button
            type="button"
            class="tap -my-2 -mr-2 ml-auto inline-flex size-11 items-center justify-center self-center text-text-dim"
            aria-label="Déplier les chiffres"
            @click="folded = false"
          >
            <UiAppIcon name="chevron" :size="20" class="rotate-90" />
          </button>
        </div>

        <template v-else>
          <div class="flex flex-col items-center gap-1 pt-1">
            <!-- Sans étape à décompter — sortie libre ou vélo — le grand chiffre
                 est le temps de la sortie : c'est ce qu'on regarde (§ 8, P10.3). -->
            <span class="label text-[10.5px]">{{ headlineLabel }}</span>
            <span
              class="display text-[72px] leading-[0.92] font-bold"
              :class="beyond && 'text-accent'"
              >{{ headline }}</span
            >
            <span v-if="target" class="mono pt-1 text-[12.5px] text-text-dim">
              cible {{ targetLine(target) }}
            </span>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span class="mono text-[26px]" :class="offBand ? 'text-warn' : 'text-text'">
              <template v-if="cycling">{{ formatSpeed(tracker.pace.value) }}</template>
              <template v-else>{{ formatPace(tracker.pace.value) }}</template>
            </span>
            <span v-if="!cycling" class="mono text-[12px] text-text-dim">/km</span>
            <span v-if="beyond" class="pill bg-ok/15 text-ok">cible atteinte</span>
            <span v-else-if="gapLine" class="pill pill-warn">{{ gapLine }}</span>
            <span v-if="tracker.lost.value" class="pill pill-warn">signal perdu</span>
            <span v-else-if="offTrack" class="pill pill-warn">hors trace</span>
          </div>

          <div class="flex items-end justify-between gap-2 border-t border-line-soft pt-3">
            <span class="flex flex-col gap-px">
              <span class="mono text-[17px]">{{ formatDistance(distanceM) }}</span>
              <span class="label text-[9.5px]">distance</span>
            </span>
            <span class="flex flex-col gap-px">
              <span class="mono text-[17px]">{{ formatDuration(elapsedS) }}</span>
              <span class="label text-[9.5px]">temps</span>
            </span>
            <span class="flex flex-col gap-px text-right">
              <span class="mono text-[17px]">
                <template v-if="!average">—</template>
                <template v-else-if="cycling">{{ formatSpeed(average) }}</template>
                <template v-else>{{ formatPace(average) }}/km</template>
              </span>
              <span class="label text-[9.5px]">{{ cycling ? 'vitesse moy.' : 'allure moy.' }}</span>
            </span>
            <button
              type="button"
              class="tap pointer-events-auto -mr-2 -mb-2 inline-flex size-11 items-center justify-center text-text-dim"
              aria-label="Replier les chiffres"
              @click="folded = true"
            >
              <UiAppIcon name="chevron" :size="20" class="-rotate-90" />
            </button>
          </div>
        </template>
      </div>

      <!-- Un voile, pas un bandeau : les ronds restent lisibles sur la carte
           sans lui prendre le bas de l'écran. -->
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 z-map h-[190px] bg-gradient-to-t from-ink to-transparent"
      />

      <div
        class="absolute bottom-[calc(28px+env(safe-area-inset-bottom))] left-6 z-map flex flex-col items-center gap-2"
      >
        <UiActionButton
          class="btn size-[76px] rounded-full p-0"
          :class="!beyond && 'btn-ghost bg-surface/95'"
          icon="stop"
          :icon-size="24"
          aria-label="Terminer"
          :action="tracker.stop"
        />
        <span class="text-[11.5px] text-text-dim">Terminer</span>
      </div>

      <button
        type="button"
        class="btn btn-ghost absolute bottom-[calc(42px+env(safe-area-inset-bottom))] left-1/2 z-map size-13 -translate-x-1/2 rounded-full p-0"
        :class="adrift ? 'border-accent bg-accent-track/95 text-accent' : 'bg-surface/95'"
        aria-label="Recentrer sur ma position"
        @click="recenter"
      >
        <UiAppIcon name="nav" :size="22" />
      </button>

      <div
        class="absolute right-6 bottom-[calc(28px+env(safe-area-inset-bottom))] z-map flex flex-col items-center gap-2"
      >
        <button
          type="button"
          class="btn size-[76px] rounded-full p-0"
          :class="beyond && 'btn-ghost bg-surface/95'"
          aria-label="Pause"
          @click="tracker.pauseRun"
        >
          <UiAppIcon name="pause" :size="26" />
        </button>
        <span class="text-[11.5px] text-text-dim">Pause</span>
      </div>
    </template>
  </div>
</template>
