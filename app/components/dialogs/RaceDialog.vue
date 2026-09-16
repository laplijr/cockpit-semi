<script setup lang="ts">
const props = defineProps<{ raceId: number }>()

const { data: races } = await useFetch('/api/races')

const race = computed(() => (races.value ?? []).find((item) => item.id === props.raceId))

const PRIORITY_MEANING: Record<string, string> = {
  A: 'Course principale : tout le cycle est construit pour elle.',
  B: 'Course secondaire : elle se court sur la forme de la course A.',
  C: 'Course test : elle remplace la séance clé de la semaine et recale le VDOT.',
}
</script>

<template>
  <div v-if="race" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">{{ race.name }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ formatLongDate(race.date) }}</span>
      <span class="pill ml-auto" :class="race.priority === 'A' && 'bg-accent/15 text-accent'">
        priorité {{ race.priority }}
      </span>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Distance</span>
        <span class="mono text-[20px]">{{ formatDistance(race.distanceM) }}</span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Objectif</span>
        <span class="mono text-[20px]">
          <template v-if="race.objectiveToSet">à fixer</template>
          <template v-else-if="race.objectiveMode === 'performance_max'">perf. max</template>
          <template v-else>{{ formatDuration(race.objectifS) }}</template>
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Projection</span>
        <span class="mono text-[20px]">{{ formatDuration(race.projectionS) }}</span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Écart</span>
        <span class="mono text-[20px]">{{ formatSignedDuration(race.gapS) }}</span>
      </div>
    </div>

    <p class="text-[13px] text-text-muted">{{ PRIORITY_MEANING[race.priority] }}</p>

    <p v-if="race.projectionIsFloor" class="text-[13px] text-text-muted">
      La projection vient du plancher de forme, pas d'une mesure. Elle sera revue au premier test
      20′.
    </p>
  </div>
</template>
