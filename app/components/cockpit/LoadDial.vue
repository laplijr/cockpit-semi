<script setup lang="ts">
const ui = useUiStore()
const { data, status } = useFetch('/api/load', { lazy: true, server: false })

const missingDays = computed(() => Math.max(0, 28 - (data.value?.historyDays ?? 0)))

const SCALE = { low: 0.5, high: 2 }

const positionPct = (value: number) =>
  ((Math.min(SCALE.high, Math.max(SCALE.low, value)) - SCALE.low) / (SCALE.high - SCALE.low)) * 100

const DEFAULT_REFERENCE = { low: 0.8, high: 1.3 }

const band = computed(() => {
  const reference = data.value?.reference ?? DEFAULT_REFERENCE
  const from = positionPct(reference.low)
  return { left: from, width: positionPct(reference.high) - from }
})

/** L'état passe dans la couleur du chiffre : la pastille qui le redisait sort (§ 8, P6.35). */
const tone = computed(() => {
  if (!data.value?.ratio) return 'text-text-dim'
  return data.value.ratio.inReferenceZone ? 'text-ok' : 'text-warn'
})
</script>

<template>
  <div v-if="isLoading(status)" class="tile dial" aria-busy="true">
    <div class="flex items-baseline justify-between">
      <span class="label"><UiInfoHint term="chargeCombinee">Charge combinée</UiInfoHint></span>
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton :height="15" width="72px" />
    <UiSkeleton variant="block" :height="14" />
  </div>

  <button
    v-else
    type="button"
    class="tile dial tile-action text-left"
    @click="ui.openDial('charge')"
  >
    <span class="flex items-baseline justify-between gap-2">
      <span class="label"><UiInfoHint term="chargeCombinee">Charge combinée</UiInfoHint></span>
    </span>

    <span class="display text-display-xl leading-none font-bold" :class="tone">
      {{ data?.ratio ? data.ratio.ratio.toFixed(2).replace('.', ',') : '—' }}
    </span>

    <span class="mono text-meta text-text-dim">
      {{ data?.ratio ? data.ratio.verdict : `encore ${missingDays} j` }}
    </span>

    <!-- L'échelle situe le chiffre : bande de référence, repère à la couleur de l'état. -->
    <span class="relative block h-[14px]">
      <span class="absolute inset-x-0 top-[6px] h-px bg-line" />
      <span
        class="absolute top-[3px] h-[7px] rounded-sm"
        :class="data?.ratio ? 'bg-ok/25' : 'bg-ok/10'"
        :style="{ left: `${band.left}%`, width: `${band.width}%` }"
      />
      <span
        v-if="data?.ratio"
        class="absolute top-0 h-[13px] w-[2px] rounded-sm"
        :class="data.ratio.inReferenceZone ? 'bg-ok' : 'bg-warn'"
        :style="{ left: `${positionPct(data.ratio.ratio)}%` }"
      />
      <span class="mono absolute top-0 left-0 text-caption text-text-dim">0,5</span>
      <span class="mono absolute top-0 right-0 text-caption text-text-dim">2,0</span>
    </span>
  </button>
</template>
