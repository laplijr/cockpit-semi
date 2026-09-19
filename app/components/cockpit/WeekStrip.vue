<script setup lang="ts">
import type { PlanSession, PlanWeekRow } from '~/stores/plan'

const props = defineProps<{
  week?: PlanWeekRow
  sessions: PlanSession[]
  today: string
  loading?: boolean
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
  <div v-if="loading" class="tile" aria-busy="true">
    <div class="flex items-baseline gap-3">
      <span class="label">Semaine</span>
      <UiSkeleton :height="22" width="200px" />
    </div>
    <!-- Le gabarit d'un jour chargé — un libellé et deux séances — parce que
         c'est le jour le plus haut qui donne sa hauteur à la rangée. -->
    <div class="grid grid-cols-7 gap-2">
      <div
        v-for="day in WEEKDAY_LABELS"
        :key="day"
        class="flex min-h-[104px] flex-col gap-2 rounded-md border border-line-soft bg-surface-inset p-3"
      >
        <UiSkeleton :height="12" width="30px" />
        <div class="flex flex-col gap-px">
          <UiSkeleton :height="20" width="76%" />
          <UiSkeleton :height="14" width="52%" />
        </div>
        <div class="flex flex-col gap-px border-t border-line-soft pt-2">
          <UiSkeleton :height="20" width="66%" />
          <UiSkeleton :height="14" width="44%" />
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="week" class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">Semaine {{ week.index }}</span>
      <span class="mono text-[11.5px] text-text-dim">
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
        :date="day.date"
        :sessions="day.sessions"
        :is-today="day.isToday"
      />
    </div>
  </div>
</template>
