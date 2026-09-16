<script setup lang="ts">
const { data } = await useFetch('/api/load')

const SPORTS = [
  { key: 'course', label: 'Course' },
  { key: 'velo', label: 'Vélo' },
  { key: 'muscu', label: 'Muscu' },
  { key: 'autre', label: 'Autre' },
] as const

/**
 * « Autre » ne s'affiche que lorsqu'un imprévu en a produit : le cadran ne
 * porte pas une colonne vide toute l'année, mais la charge affichée ne peut
 * pas être inférieure à celle que compte le ratio (§ 8).
 */
const sports = computed(() =>
  SPORTS.filter((sport) => sport.key !== 'autre' || (data.value?.weekBySport.autre ?? 0) > 0),
)

const missingDays = computed(() => Math.max(0, 28 - (data.value?.historyDays ?? 0)))
</script>

<template>
  <div class="tile">
    <div class="flex items-baseline justify-between">
      <span class="label">Charge combinée</span>
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
        7 j {{ data.ratio.acute }} UA · 21 j {{ data.ratio.chronic }} UA · repère
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

    <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
      <span class="label text-[10px]">Cette semaine</span>
      <div class="flex gap-4">
        <div v-for="sport in sports" :key="sport.key" class="flex flex-col">
          <span class="label text-[10px]">{{ sport.label }}</span>
          <span class="mono text-[15px]">{{ data?.weekBySport[sport.key] ?? 0 }} UA</span>
        </div>
      </div>
    </div>
  </div>
</template>
