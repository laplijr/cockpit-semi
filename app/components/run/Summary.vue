<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'
import { FIX_TOLERANCE } from '~~/server/domain/tracking/fix'
import type { Split } from '~~/server/domain/tracking/track'

/**
 * Bilan et ressenti d'une sortie (§ 9, P10.2) : une seule action, et elle
 * enregistre tout. Plusieurs racines, comme les autres phases de l'écran.
 */
const { tracker, session, free, briefLabel, guide, abandon } = defineProps<{
  tracker: ReturnType<typeof useRunTracker>
  session: PlanSession | undefined
  free: boolean
  briefLabel: string | undefined
  guide: { lat: number; lon: number }[]
  /** Une fonction et non un événement : le bouton attend sa fin pour se rendre (P7.3). */
  abandon: () => Promise<void>
}>()

const plan = usePlanStore()

const distanceM = computed(() => tracker.track.value.distanceM)
const elapsedS = computed(() => tracker.track.value.elapsedS)

/** Trop court pour être une séance : l'abandon passe devant l'enregistrement. */
const tooShort = computed(() => distanceM.value < FIX_TOLERANCE.minRunM)

const finishError = ref('')

/** Barre d'un split : le kilomètre le plus rapide fait la largeur pleine. */
function splitWidth(seconds: number, all: Split[]): number {
  const fastest = Math.min(...all.map((split) => split.seconds))
  return Math.round((fastest / seconds) * 100)
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
  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <h1 class="display text-display-m font-semibold">Sortie terminée</h1>
    <span class="mono w-full text-meta text-text-dim">
      <template v-if="briefLabel">{{ briefLabel }} · </template>
      <template v-else-if="free">Hors plan · </template>
      {{ formatDistance(distanceM) }} · {{ formatDuration(elapsedS) }}
    </span>
  </div>

  <div v-if="tooShort" class="tile bg-surface-inset">
    <p class="text-body text-warn">
      Moins de {{ formatDistance(FIX_TOLERANCE.minRunM) }} : ce n'est pas une séance, et ça
      fausserait la charge.
    </p>
    <UiActionButton class="btn" :action="abandon">Abandonner la sortie</UiActionButton>
    <button type="button" class="btn btn-ghost" @click="tracker.resumeRun">Reprendre</button>
  </div>

  <template v-else>
    <div class="tile bg-surface-inset">
      <span class="label text-caption">Splits</span>
      <div
        v-for="split in tracker.kilometres.value"
        :key="split.km"
        class="flex items-center gap-3"
      >
        <span class="mono w-[34px] text-meta text-text-dim">km {{ split.km }}</span>
        <span class="h-2 flex-1 rounded-sm bg-surface-muted">
          <span
            class="block h-2 rounded-sm bg-accent"
            :style="{ width: `${splitWidth(split.seconds, tracker.kilometres.value)}%` }"
          />
        </span>
        <span class="mono w-[42px] text-right text-meta">{{ formatPace(split.seconds) }}</span>
      </div>
      <p v-if="tracker.kilometres.value.length === 0" class="text-meta text-text-dim">
        Moins d'un kilomètre.
      </p>
    </div>

    <div class="tile bg-surface-inset">
      <span class="label text-caption">Trace</span>
      <ClientOnly>
        <UiRouteMap :points="tracker.track.value.points" :guide="guide" :height="190" />
      </ClientOnly>
      <span class="mono text-meta text-text-dim">
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
    <p v-else class="text-body text-text-dim">Séance introuvable : le plan n'est pas chargé.</p>

    <p v-if="finishError" class="text-body text-warn">{{ finishError }}</p>
  </template>
</template>
