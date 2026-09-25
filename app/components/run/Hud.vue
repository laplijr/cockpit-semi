<script setup lang="ts">
import type { StepTarget } from '~~/server/domain/tracking/steps'
import { averagePace } from '~~/server/domain/tracking/track'

/**
 * Le bandeau de l'écran de course (§ 9, P18) : l'étape, le grand chiffre,
 * l'allure et les trois compteurs, posés sur la carte. Il se replie pour
 * laisser la carte presque tout l'écran.
 */
const props = defineProps<{
  tracker: ReturnType<typeof useRunTracker>
  briefLabel: string | undefined
  sessionLabel: string | undefined
  cycling: boolean
  targets: StepTarget[]
  stepIndex: number
  target: StepTarget | undefined
  beyond: boolean
  headline: string
  headlineLabel: string
  offBand: boolean
  gapLine: string
  offTrack: boolean
}>()
const emit = defineEmits<{ next: [] }>()

const distanceM = computed(() => props.tracker.track.value.distanceM)
const elapsedS = computed(() => props.tracker.track.value.elapsedS)
const average = computed(() => averagePace(props.tracker.track.value))

/** Chiffres repliés : il ne reste qu'une ligne, et la carte prend le reste. */
const folded = ref(false)
</script>

<template>
  <!-- Le bandeau laisse passer le doigt, seuls ses objets le prennent :
       sinon la moitié haute de la carte serait morte sous la main. -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-map flex flex-col gap-3 bg-gradient-to-b from-ink from-80% to-transparent px-4 pt-3 pb-10"
  >
    <div class="pointer-events-auto flex items-center gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="text-body">
          <template v-if="targets.length > 0">
            {{ briefLabel }} · étape {{ stepIndex + 1 }} / {{ targets.length }}
          </template>
          <template v-else-if="cycling">{{ sessionLabel }}</template>
          <template v-else>Sortie libre</template>
        </span>
        <span class="mono truncate text-meta text-text-dim">
          <template v-if="target">{{ target.label }} · {{ targetLine(target) }}</template>
        </span>
      </div>
      <button
        v-if="targets.length > 0"
        type="button"
        class="btn btn-ghost size-11 shrink-0 bg-surface/95 p-0"
        aria-label="Passer à l'étape suivante"
        @click="emit('next')"
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
        class="display text-display-l leading-none font-bold"
        :class="beyond && 'text-accent'"
        >{{ headline }}</span
      >
      <span class="mono text-title" :class="offBand ? 'text-warn' : 'text-text-dim'">
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
        <span class="label text-caption">{{ headlineLabel }}</span>
        <span
          class="display text-display-xxl leading-[0.92] font-bold"
          :class="beyond && 'text-accent'"
          >{{ headline }}</span
        >
        <span v-if="target" class="mono pt-1 text-meta text-text-dim">
          cible {{ targetLine(target) }}
        </span>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span class="mono text-display-m" :class="offBand ? 'text-warn' : 'text-text'">
          <template v-if="cycling">{{ formatSpeed(tracker.pace.value) }}</template>
          <template v-else>{{ formatPace(tracker.pace.value) }}</template>
        </span>
        <span v-if="!cycling" class="mono text-meta text-text-dim">/km</span>
        <span v-if="beyond" class="pill bg-ok/15 text-ok">cible atteinte</span>
        <span v-else-if="gapLine" class="pill pill-warn">{{ gapLine }}</span>
        <span v-if="tracker.lost.value" class="pill pill-warn">signal perdu</span>
        <span v-else-if="offTrack" class="pill pill-warn">hors trace</span>
      </div>

      <div class="flex items-end justify-between gap-2 border-t border-line-soft pt-3">
        <span class="flex flex-col gap-px">
          <span class="mono text-title">{{ formatDistance(distanceM) }}</span>
          <span class="label text-caption">distance</span>
        </span>
        <span class="flex flex-col gap-px">
          <span class="mono text-title">{{ formatDuration(elapsedS) }}</span>
          <span class="label text-caption">temps</span>
        </span>
        <span class="flex flex-col gap-px text-right">
          <span class="mono text-title">
            <template v-if="!average">—</template>
            <template v-else-if="cycling">{{ formatSpeed(average) }}</template>
            <template v-else>{{ formatPace(average) }}/km</template>
          </span>
          <span class="label text-caption">{{ cycling ? 'vitesse moy.' : 'allure moy.' }}</span>
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
</template>
