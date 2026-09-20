<script setup lang="ts">
import { ConfidenceEvent } from '~~/server/domain/fitness/confidence-history'

/**
 * Un seul graphe, un seul axe, et l'unité qui compte : le chrono projeté sur
 * la course visée, rapide en haut (§ 9, P6.40). L'enveloppe est l'intervalle
 * de la projection — celui que la couverture de P6.6 confronte au réalisé —
 * et non la confiance traduite en largeur : elle se lit dans la bulle et dans
 * la table. Le VDOT quitte la page ; il reste la sparkline du cadran.
 */
interface ProjectionPoint {
  date: string
  projectedS: number
  lowS: number
  highS: number
  confidencePct: number
  events: string[]
}

const props = withDefaults(
  defineProps<{
    points: ProjectionPoint[]
    raceName?: string | null
    height?: number
  }>(),
  { raceName: null, height: 150 },
)

const WIDTH = 100

/** L'échelle couvre l'enveloppe et pas seulement la courbe, sinon elle déborde. */
const scale = computed(() => {
  const fast = Math.min(...props.points.map((point) => point.lowS))
  const slow = Math.max(...props.points.map((point) => point.highS))
  return { fast, slow, span: slow - fast || Math.max(1, slow * 0.02) }
})

const xOf = (index: number) =>
  props.points.length < 2 ? WIDTH / 2 : (index / (props.points.length - 1)) * WIDTH

/** Rapide en haut : c'est le sens dans lequel on lit un chrono qui s'améliore. */
const yOf = (seconds: number) => ((seconds - scale.value.fast) / scale.value.span) * 100

const drawable = computed(() => props.points.length >= 2)

const line = computed(() =>
  props.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(2)} ${yOf(point.projectedS).toFixed(2)}`,
    )
    .join(' '),
)

const band = computed(() => {
  const top = props.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(2)} ${yOf(point.lowS).toFixed(2)}`,
    )
    .join(' ')

  const bottom = props.points
    .map((_, offset) => props.points.length - 1 - offset)
    .map((index) => `L${xOf(index).toFixed(2)} ${yOf(props.points[index]!.highS).toFixed(2)}`)
    .join(' ')

  return `${top} ${bottom} Z`
})

/** Trois repères, et aucun n'empiète sur la courbe : ils vivent hors du tracé. */
const ticks = computed(() => {
  const { fast, slow } = scale.value
  return [fast, (fast + slow) / 2, slow]
})

const marginOf = (point: ProjectionPoint) => Math.round((point.highS - point.lowS) / 2)

const EVENT_LABELS: Record<string, string> = {
  [ConfidenceEvent.Test]: 'test 20′',
  [ConfidenceEvent.Race]: 'course',
  [ConfidenceEvent.Floor]: 'plancher',
  [ConfidenceEvent.Paused]: 'pause',
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- L'axe se nomme, et rien de plus : le chiffre de confiance que cette
         ligne portait vit maintenant dans la bulle et dans la table (§ 9, P6.40). -->
    <span class="label text-[9.5px]">
      <UiInfoHint term="projection">Chrono projeté</UiInfoHint>
      <template v-if="raceName"> · {{ raceName }}</template>
    </span>

    <div v-if="drawable" class="flex gap-3">
      <div class="relative flex-1" :style="{ height: `${height}px` }">
        <svg
          :viewBox="`0 0 ${WIDTH} 100`"
          preserveAspectRatio="none"
          class="h-full w-full"
          aria-hidden="true"
        >
          <path :d="band" fill="var(--color-ok)" fill-opacity="0.16" stroke="none" />
          <path
            :d="line"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>

        <!--
          Un repère par point de forme, et la bulle du glossaire pour dire ce
          qui l'a fait bouger : jamais un `title` natif (§ 9, P5.14). Le repère
          est posé par son enveloppe — `UiHoverBubble` porte déjà `relative` sur
          sa racine, et Tailwind fait gagner `relative` sur `absolute`.
        -->
        <span
          v-for="(point, index) in points"
          :key="point.date"
          class="absolute -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${xOf(index)}%`, top: `${yOf(point.projectedS)}%` }"
        >
          <UiHoverBubble :label="`Projection du ${formatDate(point.date)}`" size="lg">
            <template #trigger>
              <span class="block size-[7px] rounded-full bg-accent" />
            </template>

            <span class="label text-[10px]">{{ formatDate(point.date) }}</span>
            <span class="mono text-[12.5px]">
              {{ formatDuration(point.projectedS) }} ± {{ formatMinutes(marginOf(point) / 60) }}
            </span>
            <span class="mono text-[12px] text-text-dim">
              {{ formatDuration(point.lowS) }} – {{ formatDuration(point.highS) }} ·
              {{ point.confidencePct }} % de tenir l'objectif
            </span>
            <span v-if="point.events.length > 0" class="mono text-[11.5px] text-text-dim">
              {{ point.events.map((event) => EVENT_LABELS[event] ?? event).join(' · ') }}
            </span>
          </UiHoverBubble>
        </span>
      </div>

      <div
        class="flex shrink-0 flex-col justify-between text-right"
        :style="{ height: `${height}px` }"
      >
        <span v-for="tick in ticks" :key="tick" class="mono text-[10.5px] text-text-dim">
          {{ formatDuration(Math.round(tick)) }}
        </span>
      </div>
    </div>

    <p v-else class="text-[12.5px] text-text-dim">
      <template v-if="points.length === 1">
        Une courbe demande au moins deux points : elle vient à la mesure suivante.
      </template>
      <template v-else>
        Aucune course A dont l'objectif soit fixé : il n'y a pas encore de chrono à projeter.
      </template>
    </p>

    <div v-if="drawable" class="flex items-baseline justify-between">
      <span class="mono text-[10.5px] text-text-dim">{{ formatDate(points[0]!.date) }}</span>
      <span class="mono text-[10.5px] text-text-dim">{{ formatDate(points.at(-1)!.date) }}</span>
    </div>
  </div>
</template>
