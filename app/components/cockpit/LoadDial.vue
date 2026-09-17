<script setup lang="ts">
const ui = useUiStore()
const { data, status } = useFetch('/api/load', { lazy: true, server: false })

const missingDays = computed(() => Math.max(0, 28 - (data.value?.historyDays ?? 0)))

/** Échelle lue par le cadran : de l'arrêt (0,5) au doublement (2,0). */
const SCALE = { low: 0.5, high: 2 }

const positionPct = (value: number) =>
  ((Math.min(SCALE.high, Math.max(SCALE.low, value)) - SCALE.low) / (SCALE.high - SCALE.low)) * 100

/** Bande de référence du § 8, pour dessiner l'échelle avant le premier ratio. */
const DEFAULT_REFERENCE = { low: 0.8, high: 1.3 }

const band = computed(() => {
  const reference = data.value?.reference ?? DEFAULT_REFERENCE
  const from = positionPct(reference.low)
  return { left: from, width: positionPct(reference.high) - from }
})
</script>

<template>
  <div v-if="isLoading(status)" class="tile dial" aria-busy="true">
    <div class="flex items-baseline justify-between">
      <span class="label">Charge combinée <UiInfoHint term="chargeCombinee" /></span>
      <UiSkeleton variant="block" :height="22" width="96px" />
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton variant="block" :height="14" />
  </div>

  <div
    v-else
    class="tile dial tile-action"
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
      <!-- Le compte à rebours tient dans la pastille : la ligne, elle, dit
           pourquoi il n'y a rien à lire, et elle tient sur une ligne (§ 8). -->
      <span v-else-if="missingDays > 0" class="pill">encore {{ missingDays }} j</span>
    </div>

    <template v-if="data?.ratio">
      <span class="display text-[44px] leading-none font-bold">
        {{ data.ratio.ratio.toFixed(2).replace('.', ',') }}
      </span>
      <!-- L'échelle remplace la ligne grise : elle situe le chiffre déjà affiché. -->
      <div class="relative h-[14px]">
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
      <p class="text-[12px] text-text-muted">Le ratio demande 28 jours d'historique.</p>
      <!-- L'échelle reste, en creux : elle dit où se lira le ratio. -->
      <div class="relative h-[14px]">
        <span class="absolute inset-x-0 top-[6px] h-px bg-line" />
        <span
          class="absolute top-[3px] h-[7px] rounded-sm bg-ok/10"
          :style="{ left: `${band.left}%`, width: `${band.width}%` }"
        />
        <span class="mono absolute top-0 left-0 text-[10px] text-text-faint">0,5</span>
        <span class="mono absolute top-0 right-0 text-[10px] text-text-faint">2,0</span>
      </div>
    </template>
  </div>
</template>
