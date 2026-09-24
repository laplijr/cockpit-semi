<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean; loading?: boolean }>()

const ui = useUiStore()
const { data, status } = useFetch('/api/progression', { lazy: true, server: false })
const { data: fitness, status: fitnessStatus } = useFetch('/api/fitness', {
  lazy: true,
  server: false,
})

/** Le titre lui-même dépend du plan : sans lui, il est encore inconnu (§ 8). */
const loading = computed(
  () => props.loading || isLoading(status.value) || isLoading(fitnessStatus.value),
)

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
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton :height="15" width="72px" />
    <UiSkeleton variant="block" :height="14" class="hidden lean:block" />
  </div>

  <button v-else type="button" class="tile dial tile-action text-left" @click="ui.openDial('vdot')">
    <span class="flex min-w-0 items-baseline justify-between gap-2">
      <span class="label min-w-0 truncate">
        <UiInfoHint :term="isFloor ? 'plancher' : 'vdot'">{{ label }}</UiInfoHint>
      </span>
    </span>

    <!-- Une estimation basse se lit à la couleur du chiffre : la pastille sort (§ 8, P6.35). -->
    <span
      class="display text-display-l lean:text-display-xl leading-none font-bold"
      :class="{ 'text-warn': isFloor, 'text-text-dim': vdot === null }"
    >
      {{ vdot === null ? '—' : vdot.toFixed(1).replace('.', ',') }}
    </span>

    <!-- La nature du point et l'écart au précédent, au lieu du nombre de points (P20). -->
    <span class="mono text-meta text-text-dim">{{ fitness?.point?.verdict ?? '—' }}</span>

    <!-- L'échelle situe le chiffre : la tendance des points de forme. -->
    <svg
      v-if="line"
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      class="hidden h-[14px] w-full lean:block"
    >
      <polyline
        :points="line"
        fill="none"
        stroke="var(--color-accent)"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
      />
    </svg>
    <span v-else class="hidden h-[14px] lean:block">
      <span class="mt-[6px] block h-px bg-line" />
    </span>
  </button>
</template>
