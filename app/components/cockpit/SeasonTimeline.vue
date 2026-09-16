<script setup lang="ts">
import type { PlanPhaseRow, PlanWeekRow } from '~/stores/plan'

interface RaceRow {
  id: number
  name: string
  date: string
  priority: string
}

const props = defineProps<{
  phases: PlanPhaseRow[]
  weeks: PlanWeekRow[]
  races: RaceRow[]
  today: string
}>()

const totalWeeks = computed(() => props.weeks.length || 1)

const segments = computed(() =>
  props.phases.map((phase) => ({
    ...phase,
    weeks: phase.endWeek - phase.startWeek + 1,
    share: ((phase.endWeek - phase.startWeek + 1) / totalWeeks.value) * 100,
    race: props.races.find((race) => race.id === phase.raceId),
  })),
)

const currentWeekIndex = computed(
  () =>
    props.weeks.find((week) => week.startDate <= props.today && props.today <= week.endDate)
      ?.index ?? 0,
)
</script>

<template>
  <div v-if="segments.length > 0" class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">Cap</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ totalWeeks }} semaines jusqu'à {{ segments.at(-1)?.race?.name }}
      </span>
    </div>

    <div class="flex h-6 w-full overflow-hidden rounded-sm">
      <div
        v-for="(segment, index) in segments"
        :key="segment.id"
        class="flex items-center justify-center border-r border-ink text-[10px] whitespace-nowrap"
        :class="
          currentWeekIndex >= segment.startWeek && currentWeekIndex <= segment.endWeek
            ? 'bg-accent text-on-accent'
            : index % 2 === 0
              ? 'bg-surface-raised text-text-dim'
              : 'bg-surface-inset text-text-muted'
        "
        :style="{ width: `${segment.share}%` }"
        :title="`${PHASE_LABELS[segment.type]} · ${segment.weeks} sem.`"
      >
        <span v-if="segment.share > 6">{{ PHASE_LABELS[segment.type] }}</span>
      </div>
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-1">
      <span v-for="race in races" :key="race.id" class="mono text-[11.5px] text-text-muted">
        {{ race.name }} · {{ formatDate(race.date) }} · J−{{ daysUntil(race.date, today) }}
      </span>
    </div>
  </div>
</template>
