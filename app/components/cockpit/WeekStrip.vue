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
      <div
        v-for="day in days"
        :key="day.date"
        class="flex min-h-[96px] flex-col gap-2 rounded-md border p-3"
        :class="
          day.isToday ? 'border-accent/45 bg-surface-raised' : 'border-line-soft bg-surface-inset'
        "
      >
        <span class="label text-[10px]">{{ day.label }}</span>
        <div v-for="session in day.sessions" :key="session.id" class="flex flex-col gap-px">
          <span class="display text-[15px] font-semibold">
            {{ SESSION_LABELS[session.code] ?? session.code }}
          </span>
          <span class="mono text-[11px] text-text-muted">
            {{ formatDistance(session.prescription.totalDistanceM) }}
          </span>
        </div>
        <span v-if="day.sessions.length === 0" class="text-[12px] text-text-muted">repos</span>
      </div>
    </div>
  </div>
</template>
