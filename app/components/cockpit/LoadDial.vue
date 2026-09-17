<script setup lang="ts">
const ui = useUiStore()
const { data } = await useFetch('/api/load')

const missingDays = computed(() => Math.max(0, 28 - (data.value?.historyDays ?? 0)))
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
      <span class="mono text-[11.5px] text-text-muted">
        7 j contre 21 j · repère
        {{ data.reference.low.toFixed(1).replace('.', ',') }}–{{
          data.reference.high.toFixed(1).replace('.', ',')
        }}
      </span>
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
