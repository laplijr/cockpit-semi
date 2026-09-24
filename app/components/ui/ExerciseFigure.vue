<script setup lang="ts">
import { FIGURES } from '~/utils/exercise-figures'
import { resolvedPoses, shapeAt, type FigureShape } from '~/utils/exercise-figures/draw'
import { FRAME } from '~/utils/exercise-figures/skeleton'

/**
 * Le geste d'un exercice (P25) : un bonhomme au trait qui passe d'une pose à
 * l'autre au rythme du tempo prescrit. Figé, il montre sa pose clé — c'est la
 * vignette de la structure d'une séance. Un isométrique n'a qu'une pose, et sa
 * durée tenue dessous. Sous `prefers-reduced-motion`, les deux poses côte à
 * côte, sans mouvement.
 */
const props = withDefaults(
  defineProps<{
    exerciseId: string
    tempo?: string
    /** Figée sur la pose clé : la vignette ne bouge pas. */
    still?: boolean
    /** Secondes tenues, pour un isométrique. */
    holdS?: number
    width?: number
  }>(),
  { tempo: undefined, still: false, holdS: undefined, width: 120 },
)

const figure = computed(() => FIGURES[props.exerciseId])
const poses = computed(() => (figure.value ? resolvedPoses(figure.value) : []))
/** Le nombre de positions : un gros plan en a deux, comme un geste simple. */
const positions = computed(() => (figure.value?.closeUp ? 2 : poses.value.length))
const moving = computed(() => !props.still && positions.value >= 2)

const reducedMotion = ref(false)
const progress = ref(0)
let frame = 0

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!moving.value || reducedMotion.value) return
  const phases = figure.value?.walking
    ? WALK_PHASES
    : props.holdS
      ? HOLD_PHASES
      : tempoPhases(props.tempo)
  const start = performance.now()
  const tick = (now: number) => {
    const seconds = (now - start) / 1000
    progress.value =
      positions.value > 2
        ? sequenceProgress(positions.value, seconds)
        : tempoProgress(phases, seconds)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))

const keyPose = computed(() => figure.value?.keyPose ?? positions.value - 1)

/** Les dessins à poser : un seul en mouvement ou figé, toutes les poses côte à côte sans mouvement. */
const frames = computed<FigureShape[]>(() => {
  const current = figure.value
  if (!current) return []
  if (moving.value && reducedMotion.value) {
    return Array.from({ length: positions.value }, (_, index) =>
      shapeAt(current, poses.value, index),
    )
  }
  const t = moving.value ? progress.value : keyPose.value
  return [shapeAt(current, poses.value, t)]
})

const TONES = {
  corps: 'var(--color-text)',
  loin: 'color-mix(in srgb, var(--color-text) 38%, var(--color-surface))',
  charge: 'var(--color-accent)',
  decor: 'var(--color-text-muted)',
  meuble: 'var(--color-line-strong)',
} as const
</script>

<template>
  <span v-if="figure" class="inline-flex flex-col items-center gap-1" aria-hidden="true">
    <span class="flex gap-2">
      <svg
        v-for="(shape, index) in frames"
        :key="index"
        :viewBox="`0 0 ${FRAME.width} ${FRAME.height}`"
        :width="width"
        :height="(width * FRAME.height) / FRAME.width"
      >
        <template v-for="(item, itemIndex) in shape.items" :key="itemIndex">
          <line
            v-if="item.kind === 'line'"
            :x1="item.from[0]"
            :y1="item.from[1]"
            :x2="item.to[0]"
            :y2="item.to[1]"
            :stroke="TONES[item.tone]"
            :stroke-width="item.width"
            stroke-linecap="round"
          />
          <circle
            v-else-if="item.kind === 'circle'"
            :cx="item.at[0]"
            :cy="item.at[1]"
            :r="item.r"
            :fill="item.fill ? TONES[item.tone] : 'none'"
            :stroke="item.fill ? 'none' : TONES[item.tone]"
            stroke-width="2.5"
          />
          <rect
            v-else-if="item.kind === 'rect'"
            :x="item.x"
            :y="item.y"
            :width="item.width"
            :height="item.height"
            rx="2"
            :fill="TONES[item.tone]"
          />
          <path
            v-else
            :d="item.d"
            :fill="TONES[item.tone]"
            :stroke="item.width ? TONES[item.tone] : 'none'"
            :stroke-width="item.width ?? 0"
            stroke-linejoin="round"
          />
        </template>
      </svg>
    </span>
    <span v-if="holdS" class="mono text-meta text-text-dim"> {{ holdS }}″ tenues </span>
  </span>
</template>
