<script setup lang="ts">
interface RaceRow {
  id: number
  name: string
  date: string
  distanceM: number
  priority: string
  objectiveMode: string
  objectifS: number | null
  projectionS: number | null
  projectionIsFloor: boolean | null
  gapS: number | null
  objectiveToSet: boolean
}

const props = defineProps<{ race?: RaceRow; today: string }>()

const countdown = computed(() => (props.race ? daysUntil(props.race.date, props.today) : null))
</script>

<template>
  <div v-if="race" class="tile" style="border-color: rgba(242, 162, 58, 0.35)">
    <div class="flex items-baseline justify-between">
      <span class="label">Course A · {{ race.name }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ formatDate(race.date) }}</span>
    </div>

    <span class="display text-[44px] leading-none font-bold text-accent">J−{{ countdown }}</span>

    <div class="grid grid-cols-2 gap-[10px]">
      <div class="flex flex-col">
        <span class="label text-[10.5px]">Objectif</span>
        <span v-if="race.objectiveToSet" class="text-[13px] text-text-muted">à fixer</span>
        <span v-else-if="race.objectiveMode === 'performance_max'" class="text-[13px]">
          performance maximale
        </span>
        <span v-else class="mono text-[17px]">{{ formatDuration(race.objectifS) }}</span>
      </div>
      <div class="flex flex-col">
        <span class="label text-[10.5px]">Projection</span>
        <span class="mono text-[17px]">{{ formatDuration(race.projectionS) }}</span>
      </div>
    </div>

    <p v-if="race.projectionIsFloor" class="text-[12px] text-text-muted">
      Projection calculée sur le plancher de forme, pas sur une mesure. Elle sera revue au premier
      test.
    </p>
  </div>

  <div v-else class="tile border-dashed">
    <span class="label">Course A</span>
    <p class="text-[13px] text-text-muted">Aucune course à venir. Ajoute-en une depuis Courses.</p>
  </div>
</template>
