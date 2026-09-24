<script setup lang="ts">
/**
 * Courbe d'une série datée, dessinée en SVG sans bibliothèque. Elle porte en
 * clair sa première et sa dernière valeur, chacune au-dessus de sa date : le
 * maximum à gauche et le minimum à droite se lisaient comme un départ et une
 * arrivée, donc une série qui monte passait pour une baisse (P19).
 */
const props = withDefaults(
  defineProps<{
    points: { date: string; value: number }[]
    height?: number
    /** Unité affichée à côté des valeurs ; vide par défaut. */
    unit?: string
    /** Décimales des valeurs. */
    decimals?: number
  }>(),
  { height: 120, unit: '', decimals: 1 },
)

const WIDTH = 100

const bounds = computed(() => {
  const values = props.points.map((point) => point.value)
  const low = Math.min(...values)
  const high = Math.max(...values)
  /** Une série plate garde une amplitude minimale, sinon elle sort de la boîte. */
  const span = high - low || Math.max(1, Math.abs(high) * 0.1)
  return { low, high, span }
})

const line = computed(() => {
  if (props.points.length < 2) return null
  const { low, span } = bounds.value

  return props.points
    .map((point, index) => {
      const x = (index / (props.points.length - 1)) * WIDTH
      const y = 100 - ((point.value - low) / span) * 100
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
})

const label = (value: number) => `${formatDecimal(value, props.decimals)}${props.unit}`
</script>

<template>
  <div v-if="line" class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between">
      <span class="mono text-caption text-text-dim">{{ label(points[0]!.value) }}</span>
      <span class="mono text-caption text-text-dim">{{ label(points.at(-1)!.value) }}</span>
    </div>

    <svg
      :viewBox="`0 0 ${WIDTH} 100`"
      preserveAspectRatio="none"
      class="w-full"
      :style="{ height: `${height}px` }"
      aria-hidden="true"
    >
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

    <div class="flex items-baseline justify-between">
      <span class="mono text-caption text-text-dim">{{ formatDate(points[0]!.date) }}</span>
      <span class="mono text-caption text-text-dim">{{ formatDate(points.at(-1)!.date) }}</span>
    </div>
  </div>

  <p v-else class="text-meta text-text-dim">
    Une courbe demande au moins deux points : elle vient à la mesure suivante.
  </p>
</template>
