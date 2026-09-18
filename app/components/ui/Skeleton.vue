<script setup lang="ts">
/**
 * Un état de chargement a la forme de son contenu (§ 8) : le squelette occupe
 * la hauteur exacte de ce qu'il attend, pour que rien ne bouge à l'arrivée de
 * la donnée. La barre visible est plus fine que la boîte, comme une ligne de
 * texte dans son interligne.
 */
const props = withDefaults(
  defineProps<{
    variant?: 'block' | 'line' | 'number'
    /** Longueur CSS ; par défaut celle du gabarit. */
    width?: string
    /** Hauteur de la boîte en pixels ; par défaut celle du gabarit. */
    height?: number
  }>(),
  { variant: 'line', width: undefined, height: undefined },
)

const SHAPES = {
  block: { height: 14, width: '100%', fill: 1 },
  line: { height: 16, width: '100%', fill: 0.62 },
  number: { height: 56, width: '112px', fill: 0.72 },
} as const

const shape = computed(() => SHAPES[props.variant])
const boxHeight = computed(() => props.height ?? shape.value.height)
const barHeight = computed(() => Math.round(boxHeight.value * shape.value.fill))
</script>

<template>
  <span
    aria-hidden="true"
    class="flex shrink-0 items-center"
    :style="{ height: `${boxHeight}px`, width: width ?? shape.width }"
  >
    <span
      class="w-full animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none"
      :style="{ height: `${barHeight}px` }"
    />
  </span>
</template>
