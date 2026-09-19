<script setup lang="ts">
import { ConfidenceEvent } from '~~/server/domain/fitness/confidence-history'

interface ConfidencePoint {
  date: string
  confidencePct: number
  projectedS: number
  events: string[]
}

/**
 * Les deux étages de la forme, sur le même axe de dates : le VDOT mesuré au-
 * dessus, la confiance de tenir l'objectif en dessous. Un point de confiance
 * par point de forme, donc les mêmes abscisses — le § 8 compte l'ensemble pour
 * une seule information.
 */
const props = withDefaults(
  defineProps<{
    vdot: { date: string; value: number }[]
    confidence?: ConfidencePoint[]
    /** Course dont la confiance est tracée ; le titre la nomme. */
    raceName?: string | null
    height?: number
    bandHeight?: number
  }>(),
  { confidence: () => [], raceName: null, height: 120, bandHeight: 56 },
)

const WIDTH = 100

const bounds = computed(() => {
  const values = props.vdot.map((point) => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  return { low, high, span: high - low || Math.max(1, Math.abs(high) * 0.1) }
})

/** Les deux étages partagent l'axe des dates : une seule échelle horizontale. */
const dates = computed(() => props.vdot.map((point) => point.date))

function xOf(date: string): number {
  if (dates.value.length < 2) return WIDTH / 2
  const index = dates.value.indexOf(date)
  const position = index === -1 ? nearestIndex(date) : index
  return (position / (dates.value.length - 1)) * WIDTH
}

function nearestIndex(date: string): number {
  const after = dates.value.findIndex((item) => item >= date)
  return after === -1 ? dates.value.length - 1 : after
}

const vdotLine = computed(() => {
  if (props.vdot.length < 2) return null
  const { low, span } = bounds.value

  return props.vdot
    .map((point, index) => {
      const x = (index / (props.vdot.length - 1)) * WIDTH
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${(100 - ((point.value - low) / span) * 100).toFixed(2)}`
    })
    .join(' ')
})

const confidenceLine = computed(() => {
  if (props.confidence.length < 2) return null

  return props.confidence
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xOf(point.date).toFixed(2)} ${(100 - point.confidencePct).toFixed(2)}`,
    )
    .join(' ')
})

const EVENT_LABELS: Record<string, string> = {
  [ConfidenceEvent.Test]: 'test 20′',
  [ConfidenceEvent.Race]: 'course',
  [ConfidenceEvent.Floor]: 'plancher',
  [ConfidenceEvent.Paused]: 'pause',
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between">
      <span class="mono text-[10.5px] text-text-dim">{{ formatDecimal(bounds.high, 1) }}</span>
      <span class="mono text-[10.5px] text-text-dim">{{ formatDecimal(bounds.low, 1) }}</span>
    </div>

    <svg
      v-if="vdotLine"
      :viewBox="`0 0 ${WIDTH} 100`"
      preserveAspectRatio="none"
      class="w-full"
      :style="{ height: `${height}px` }"
      aria-hidden="true"
    >
      <path
        :d="vdotLine"
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>

    <p v-else class="text-[12.5px] text-text-dim">
      Une courbe demande au moins deux points : elle vient à la mesure suivante.
    </p>

    <!-- Deuxième étage : la confiance, sur la même échelle de dates. -->
    <template v-if="confidence.length > 0">
      <div class="mt-1 flex items-baseline justify-between border-t border-line-soft pt-1">
        <span class="label text-[9.5px]">
          <UiInfoHint term="confiance">Confiance</UiInfoHint>
          <template v-if="raceName"> · {{ raceName }}</template>
        </span>
        <span class="mono text-[10.5px] text-text-dim"
          >{{ confidence.at(-1)?.confidencePct }} %</span
        >
      </div>

      <div class="relative" :style="{ height: `${bandHeight}px` }">
        <svg
          :viewBox="`0 0 ${WIDTH} 100`"
          preserveAspectRatio="none"
          class="h-full w-full"
          aria-hidden="true"
        >
          <path
            v-if="confidenceLine"
            :d="confidenceLine"
            fill="none"
            stroke="var(--color-ok)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>

        <!--
          Un repère par point, et la bulle du glossaire pour dire ce qui l'a
          fait bouger : jamais un `title` natif (§ 9, P5.14).
        -->
        <!--
          Le repère est posé par son enveloppe : `UiHoverBubble` porte déjà
          `relative` sur sa racine, et Tailwind fait gagner `relative` sur
          `absolute` quoi qu'on écrive dans l'attribut.
        -->
        <span
          v-for="point in confidence"
          :key="point.date"
          class="absolute -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${xOf(point.date)}%`, top: `${100 - point.confidencePct}%` }"
        >
          <UiHoverBubble :label="`Confiance du ${formatDate(point.date)}`">
            <template #trigger>
              <span class="block size-[7px] rounded-full bg-ok" />
            </template>

            <span class="label text-[10px]">{{ formatDate(point.date) }}</span>
            <span class="mono text-[12.5px]">
              {{ point.confidencePct }} % · projection {{ formatDuration(point.projectedS) }}
            </span>
            <span v-if="point.events.length > 0" class="mono text-[11.5px] text-text-dim">
              {{ point.events.map((event) => EVENT_LABELS[event] ?? event).join(' · ') }}
            </span>
          </UiHoverBubble>
        </span>
      </div>
    </template>

    <div v-if="dates.length > 0" class="flex items-baseline justify-between">
      <span class="mono text-[10.5px] text-text-dim">{{ formatDate(dates[0]!) }}</span>
      <span class="mono text-[10.5px] text-text-dim">{{ formatDate(dates.at(-1)!) }}</span>
    </div>
  </div>
</template>
