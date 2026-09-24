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
const moving = computed(() => !props.still && poses.value.length === 2)

const reducedMotion = ref(false)
const progress = ref(0)
let frame = 0

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!moving.value || reducedMotion.value) return
  const phases = tempoPhases(props.tempo)
  const start = performance.now()
  const tick = (now: number) => {
    progress.value = tempoProgress(phases, (now - start) / 1000)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))

const keyPose = computed(() => (poses.value.length === 1 ? 0 : (figure.value?.keyPose ?? 1)))

/** Les dessins à poser : un seul en mouvement ou figé, deux côte à côte sans mouvement. */
const frames = computed<FigureShape[]>(() => {
  const current = figure.value
  if (!current) return []
  if (moving.value && reducedMotion.value) {
    return [shapeAt(current, poses.value, 0), shapeAt(current, poses.value, 1)]
  }
  const t = moving.value ? progress.value : keyPose.value
  return [shapeAt(current, poses.value, t)]
})

const TONES = {
  corps: 'var(--color-text)',
  loin: 'color-mix(in srgb, var(--color-text) 40%, transparent)',
  charge: 'var(--color-accent)',
  decor: 'var(--color-line-strong)',
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
        <rect
          v-for="(rect, rectIndex) in shape.rects"
          :key="`r${rectIndex}`"
          :x="rect.x"
          :y="rect.y"
          :width="rect.width"
          :height="rect.height"
          fill="none"
          :stroke="TONES.decor"
          stroke-width="1.5"
        />
        <line
          v-for="(line, lineIndex) in shape.lines"
          :key="`l${lineIndex}`"
          :x1="line.from[0]"
          :y1="line.from[1]"
          :x2="line.to[0]"
          :y2="line.to[1]"
          :stroke="TONES[line.tone]"
          :stroke-width="line.tone === 'decor' ? 1.5 : 3.5"
          stroke-linecap="round"
        />
        <circle
          v-for="(circle, circleIndex) in shape.circles"
          :key="`c${circleIndex}`"
          :cx="circle.at[0]"
          :cy="circle.at[1]"
          :r="circle.r"
          :fill="circle.fill ? TONES[circle.tone] : 'none'"
          :stroke="circle.fill ? 'none' : TONES[circle.tone]"
          stroke-width="2.5"
        />
      </svg>
    </span>
    <span v-if="holdS && poses.length === 1" class="mono text-meta text-text-dim">
      {{ holdS }}″ tenues
    </span>
  </span>
</template>
