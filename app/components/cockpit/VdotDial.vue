<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean }>()

const ui = useUiStore()
const { data } = await useFetch('/api/progression')

const label = computed(() => (props.isFloor ? 'Plancher' : 'VDOT'))

/** Points de forme mesurés : c'est eux que la sparkline dessine. */
const points = computed(() => (data.value?.vdot ?? []).map((point) => point.vdot))

/**
 * Sparkline en polyligne SVG : l'échelle est la plage des points elle-même,
 * élargie d'un demi-point pour qu'une progression plate ne se lise pas comme
 * un mur.
 */
const line = computed(() => {
  if (points.value.length < 2) return null

  const low = Math.min(...points.value) - 0.5
  const high = Math.max(...points.value) + 0.5
  const span = high - low

  return points.value
    .map((value, index) => {
      const x = (index / (points.value.length - 1)) * 100
      const y = 20 - ((value - low) / span) * 20
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <div
    class="tile tile-action"
    role="button"
    :tabindex="0"
    @click="ui.openDial('vdot')"
    @keydown.enter.prevent="ui.openDial('vdot')"
    @keydown.space.prevent="ui.openDial('vdot')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label"> {{ label }} <UiInfoHint :term="isFloor ? 'plancher' : 'vdot'" /> </span>
      <span v-if="isFloor" class="pill pill-warn">estimation basse</span>
    </div>

    <span class="display text-[44px] leading-none font-bold">
      {{ vdot === null ? '—' : vdot.toFixed(1).replace('.', ',') }}
    </span>

    <!-- L'échelle remplace la ligne grise : la tendance situe le chiffre. -->
    <svg v-if="line" viewBox="0 0 100 20" preserveAspectRatio="none" class="h-[14px] w-full">
      <polyline
        :points="line"
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
      />
    </svg>
    <span v-else class="mono text-[11.5px] text-text-muted">
      un seul point de forme : la tendance vient au prochain test
    </span>
  </div>
</template>
