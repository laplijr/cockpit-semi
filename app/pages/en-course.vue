<script setup lang="ts">
import { FIX_TOLERANCE } from '~~/server/domain/tracking/fix'
import { paceGap, paceOffBand, stepRemaining } from '~~/server/domain/tracking/steps'
import type { StepTarget } from '~~/server/domain/tracking/steps'
import { averagePace, offTrackM } from '~~/server/domain/tracking/track'

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

const started = ref(false)
const stepIndex = ref(0)
const stepSince = ref({ distanceM: 0, elapsedS: 0 })

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

/** La carte gardée avant de partir, pour le hors-réseau (§ 9, P10.3). */
const tilesReady = useOfflineTiles(() => guide.value)

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

/**
 * Lisible en plein soleil (P21, arbitrage de Ronan du 24 sept. 2026) : un jeu
 * de jetons clair et très contrasté, propre à cet écran, retenu sur
 * l'appareil. Le reste de l'app garde son thème sombre.
 */
const SUN_KEY = 'en-course:plein-soleil'
const sunlight = ref(false)
onMounted(() => {
  try {
    sunlight.value = localStorage.getItem(SUN_KEY) === '1'
  } catch {
    sunlight.value = false
  }
})
watch(sunlight, (value) => {
  try {
    localStorage.setItem(SUN_KEY, value ? '1' : '0')
  } catch {
    // Un stockage refusé laisse le réglage à cette visite.
  }
})

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

const blockLines = computed(() => stepBlockLines(brief.value?.blocks ?? []))

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
</script>

<template>
  <div
    :class="[
      immersive
        ? 'relative h-dvh overflow-hidden bg-ink'
        : 'flex min-h-dvh flex-col gap-3 bg-ink px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]',
      sunlight && 'plein-soleil',
    ]"
  >
    <!-- `dvh` et non `vh` : sur un navigateur de téléphone, `100vh` est la
         hauteur barres rétractées — un document plus haut que ce qu'on voit,
         donc du vide noir sous le dernier bouton (§ 8, P7.4). Le pied garde la
         zone sûre : l'action de l'écran est poussée en bas par `mt-auto`, et
         sans elle elle tombe sur la barre d'accueil. -->
    <p v-if="briefError && !cycling && !free" class="tile text-body text-warn">
      Cette séance ne se court pas depuis le cockpit.
      <NuxtLink to="/" class="text-accent">Retour au cockpit</NuxtLink>
    </p>

    <!-- 1 · Préparation : les étapes, la boucle, et le seul geste qui demande
         les autorisations — écran allumé, position, voix. -->
    <template v-else-if="!started">
      <NuxtLink
        to="/"
        class="tap -ml-2 inline-flex h-11 items-center gap-2 px-2 text-body text-text-dim"
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
        <h1 class="display text-display-m font-semibold">
          {{ free ? 'Sortie libre' : (brief?.label ?? session?.prescription.label ?? 'Sortie') }}
        </h1>
        <span v-if="brief?.key" class="pill bg-accent/15 text-accent">clé</span>
        <span v-if="brief" class="mono w-full text-meta text-text-dim">
          {{ formatLongDate(brief.date) }} · {{ formatDistance(brief.totalDistanceM) }} ·
          {{ formatMinutes(brief.totalDurationS / 60) }}
        </span>
        <span v-else-if="free" class="mono w-full text-meta text-text-dim">
          Hors plan · ni étape ni allure à tenir
        </span>
        <span v-else-if="cycling" class="mono w-full text-meta text-text-dim">
          {{ formatLongDate(session!.date) }} ·
          {{ formatMinutes(session!.prescription.durationMin) }}
        </span>
      </div>

      <div v-if="blockLines.length > 0" class="tile bg-surface-inset">
        <span class="label text-caption">Étapes</span>
        <div
          v-for="(step, index) in blockLines"
          :key="`${step.label}-${index}`"
          class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
        >
          <span class="flex-1 text-body">{{ step.label }}</span>
          <span class="mono text-right text-meta text-text-dim">{{ step.line }}</span>
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
          class="mono -mt-1 text-meta"
          :class="tilesReady ? 'text-text-dim' : 'text-warn'"
        >
          <template v-if="tilesReady">Carte gardée pour le hors-réseau</template>
          <template v-else>Carte à garder avant de partir</template>
        </span>
      </template>

      <div class="tile bg-surface-inset">
        <span class="label text-caption">Avant de partir</span>
        <p class="text-meta text-text-dim">
          L'écran reste allumé pendant la sortie : le navigateur ne sait pas suivre le GPS en
          arrière-plan.
        </p>
        <label class="flex min-h-11 items-center gap-[10px] text-body">
          <input v-model="tracker.announcing.value" type="checkbox" class="size-5 accent-accent" />
          Annonces vocales à chaque kilomètre et à chaque étape
        </label>
        <label class="flex min-h-11 items-center gap-[10px] text-body">
          <input v-model="sunlight" type="checkbox" class="size-5 accent-accent" />
          Écran plein soleil : clair et très contrasté
        </label>
      </div>

      <!-- « Démarrer » se voit sans défiler : il vit dans un pied fixe, au-dessus
           de la zone sûre, et la page défile dessous (P21). -->
      <div
        class="sticky bottom-0 z-10 -mx-4 mt-auto -mb-[calc(16px+env(safe-area-inset-bottom))] border-t border-line bg-ink px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lean:static lean:mx-0 lean:mb-0 lean:border-t-0 lean:p-0"
      >
        <UiActionButton class="btn btn-lg w-full" :action="start">
          <template v-if="toBilan">Reprendre l'enregistrement</template>
          <template v-else-if="resuming">Reprendre la sortie</template>
          <template v-else>Démarrer</template>
        </UiActionButton>
      </div>
    </template>

    <!-- 2 · Acquisition : le chrono attend une position digne de ce nom. -->
    <template v-else-if="tracker.phase.value === RunPhase.Acquisition">
      <div class="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span class="display text-display-m font-semibold">Recherche du signal</span>
        <span class="mono text-copy text-warn">
          <template v-if="tracker.accuracyM.value === null">signal absent</template>
          <template v-else>précision {{ Math.round(tracker.accuracyM.value) }} m</template>
        </span>
        <p class="max-w-[280px] text-meta text-text-dim">
          Le chrono part dès que la précision passe sous {{ FIX_TOLERANCE.startAccuracyM }} m. Rien
          n'est compté avant : une dérive au départ fabriquerait de la distance qui n'existe pas.
        </p>
        <p v-if="tracker.error.value" class="text-body text-warn">{{ tracker.error.value }}</p>
      </div>

      <button type="button" class="btn btn-ghost btn-lg" @click="tracker.startAnyway">
        Démarrer quand même
      </button>
      <UiActionButton class="btn btn-ghost" :action="abandon"> Annuler </UiActionButton>
    </template>

    <!-- 4 · Pause : chiffres figés, GPS coupé, trois issues. -->
    <template v-else-if="tracker.phase.value === RunPhase.Paused">
      <div class="flex items-center gap-3">
        <span class="flex-1 text-body">
          {{ brief?.label }} · étape {{ stepIndex + 1 }} / {{ targets.length }}
        </span>
        <span class="pill pill-warn">en pause</span>
      </div>

      <div class="flex flex-1 flex-col items-center justify-center gap-1">
        <span class="label text-caption">Temps de la sortie</span>
        <span class="display text-display-xxl leading-none font-bold text-text-dim">
          {{ formatDuration(elapsedS) }}
        </span>
        <span class="mono text-copy text-text-dim">
          {{ formatDistance(distanceM) }}
          <template v-if="average">
            · <template v-if="cycling">{{ formatSpeed(average) }}</template>
            <template v-else>{{ formatPace(average) }}/km</template>
          </template>
        </span>
        <p class="mt-3 max-w-[280px] text-center text-meta text-text-dim">
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
      <RunSummary
        :tracker="tracker"
        :session="session"
        :free="free"
        :brief-label="brief?.label"
        :guide="guide"
        :abandon="abandon"
      />
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

      <RunHud
        :tracker="tracker"
        :brief-label="brief?.label"
        :session-label="session?.prescription.label"
        :cycling="cycling"
        :targets="targets"
        :step-index="stepIndex"
        :target="target"
        :beyond="beyond"
        :headline="headline"
        :headline-label="headlineLabel"
        :off-band="offBand"
        :gap-line="gapLine"
        :off-track="offTrack"
        @next="nextStep"
      />

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
        <span class="text-meta text-text-dim">Terminer</span>
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
        <span class="text-meta text-text-dim">Pause</span>
      </div>
    </template>
  </div>
</template>
