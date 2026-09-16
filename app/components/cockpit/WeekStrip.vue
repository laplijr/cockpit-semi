<script setup lang="ts">
import type { PlanSession, PlanWeekRow } from '~/stores/plan'

const props = defineProps<{
  week?: PlanWeekRow
  sessions: PlanSession[]
  today: string
}>()

const days = computed(() => {
  if (!props.week) return []
  const start = Date.parse(props.week.startDate)
  return WEEKDAY_LABELS.map((label, offset) => {
    const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10)
    return {
      label,
      date,
      isToday: date === props.today,
      sessions: props.sessions.filter((session) => session.date === date),
    }
  })
})
</script>

<template>
  <div v-if="week" class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">Semaine {{ week.index }}</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ PHASE_LABELS[week.phaseType] ?? week.phaseType }} ·
        {{ formatDistance(week.targetRunM) }} visés
      </span>
      <span v-if="week.light" class="pill ml-auto">allégée</span>
      <span v-else-if="week.comebackRatio" class="pill pill-warn ml-auto">
        reprise {{ Math.round(week.comebackRatio * 100) }} %
      </span>
    </div>

    <div class="grid grid-cols-7 gap-2">
      <CockpitDayCell
        v-for="day in days"
        :key="day.date"
        :label="day.label"
        :sessions="day.sessions"
        :is-today="day.isToday"
      />
    </div>
  </div>
</template>
