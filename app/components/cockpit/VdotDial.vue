<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean; loading?: boolean }>()

const ui = useUiStore()
const { data, status } = useFetch('/api/progression', { lazy: true, server: false })

/** Le titre lui-même dépend du plan : sans lui, il est encore inconnu (§ 8). */
const loading = computed(() => props.loading || isLoading(status.value))

const label = computed(() => (props.isFloor ? 'Plancher' : 'VDOT'))

const points = computed(() => (data.value?.vdot ?? []).map((point) => point.vdot))

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
  <div v-if="loading" class="tile dial" aria-busy="true">
    <div class="flex items-baseline justify-between">
      <span class="label"><UiSkeleton :height="15" width="72px" /></span>
      <UiSkeleton variant="block" :height="22" width="104px" />
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton variant="block" :height="14" />
  </div>

  <div
    v-else
    class="tile dial tile-action"
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
