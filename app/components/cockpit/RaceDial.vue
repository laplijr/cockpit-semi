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

const ui = useUiStore()

const countdown = computed(() => (props.race ? daysUntil(props.race.date, props.today) : null))
</script>

<template>
  <div
    v-if="race"
    class="tile tile-action"
    style="border-color: rgba(242, 162, 58, 0.35)"
    role="button"
    :tabindex="0"
    @click="ui.openDial('course-a')"
    @keydown.enter.prevent="ui.openDial('course-a')"
    @keydown.space.prevent="ui.openDial('course-a')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label">Course A · {{ race.name }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ formatDate(race.date) }}</span>
    </div>

    <span class="display text-[44px] leading-none font-bold text-accent">J−{{ countdown }}</span>

    <span class="mono text-[11.5px] text-text-muted">
      <template v-if="race.objectiveToSet">objectif à fixer</template>
      <template v-else-if="race.objectiveMode === 'performance_max'">
        performance maximale
      </template>
      <template v-else>objectif {{ formatDuration(race.objectifS) }}</template>
    </span>
  </div>

  <div v-else class="tile border-dashed">
    <span class="label">Course A</span>
    <p class="text-[13px] text-text-muted">Aucune course à venir. Ajoute-en une depuis Courses.</p>
  </div>
</template>
