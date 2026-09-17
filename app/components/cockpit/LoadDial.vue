<script setup lang="ts">
const ui = useUiStore()
const { data } = await useFetch('/api/load')

const missingDays = computed(() => Math.max(0, 28 - (data.value?.historyDays ?? 0)))

/** Échelle lue par le cadran : de l'arrêt (0,5) au doublement (2,0). */
const SCALE = { low: 0.5, high: 2 }

const positionPct = (value: number) =>
  ((Math.min(SCALE.high, Math.max(SCALE.low, value)) - SCALE.low) / (SCALE.high - SCALE.low)) * 100

const band = computed(() => {
  const reference = data.value?.reference
  if (!reference) return null
  const from = positionPct(reference.low)
  return { left: from, width: positionPct(reference.high) - from }
})
</script>

<template>
  <div
    class="tile tile-action"
    role="button"
    :tabindex="0"
    @click="ui.openDial('charge')"
    @keydown.enter.prevent="ui.openDial('charge')"
    @keydown.space.prevent="ui.openDial('charge')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label">Charge combinée <UiInfoHint term="chargeCombinee" /></span>
      <span
        v-if="data?.ratio"
        class="pill"
        :class="data.ratio.inReferenceZone ? 'pill-done' : 'pill-warn'"
      >
        {{ data.ratio.inReferenceZone ? 'zone de référence' : 'hors zone' }}
      </span>
    </div>

    <template v-if="data?.ratio">
      <span class="display text-[44px] leading-none font-bold">
        {{ data.ratio.ratio.toFixed(2).replace('.', ',') }}
      </span>
      <!-- L'échelle remplace la ligne grise : elle situe le chiffre déjà affiché. -->
      <div v-if="band" class="relative h-[14px]">
        <span class="absolute inset-x-0 top-[6px] h-px bg-line" />
        <span
          class="absolute top-[3px] h-[7px] rounded-sm bg-ok/25"
          :style="{ left: `${band.left}%`, width: `${band.width}%` }"
        />
        <span
          class="absolute top-0 h-[13px] w-[2px] rounded-sm"
          :class="data.ratio.inReferenceZone ? 'bg-ok' : 'bg-warn'"
          :style="{ left: `${positionPct(data.ratio.ratio)}%` }"
        />
        <span class="mono absolute top-0 left-0 text-[10px] text-text-faint">0,5</span>
        <span class="mono absolute top-0 right-0 text-[10px] text-text-faint">2,0</span>
      </div>
    </template>

    <template v-else>
      <span class="display text-[44px] leading-none font-bold text-text-muted">—</span>
      <p class="text-[12px] text-text-muted">
        Le ratio demande 28 jours d'historique.
        <template v-if="missingDays > 0">Encore {{ missingDays }} jours.</template>
      </p>
    </template>
  </div>
</template>
