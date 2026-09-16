<script setup lang="ts">
const plan = usePlanStore()
await plan.load()

const BLOCK_SIZE = 4
const offset = ref(0)

const currentIndex = computed(() => plan.currentWeek?.index ?? 1)

const block = computed(() => {
  const weeks = plan.plan?.weeks ?? []
  const start = Math.max(0, currentIndex.value - 1 + offset.value * BLOCK_SIZE)
  return weeks.slice(start, start + BLOCK_SIZE)
})

const canGoBack = computed(() => currentIndex.value - 1 + offset.value * BLOCK_SIZE > 0)
const canGoForward = computed(
  () => currentIndex.value - 1 + (offset.value + 1) * BLOCK_SIZE < (plan.plan?.weeks.length ?? 0),
)

function daysOf(week: { id: number; startDate: string }) {
  const sessions = plan.sessionsByWeek.get(week.id) ?? []
  const start = Date.parse(week.startDate)
  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10)
    return {
      label,
      date,
      isToday: date === plan.today,
      sessions: sessions.filter((s) => s.date === date),
    }
  })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <span class="label">Bloc de quatre semaines</span>
      <span class="mono text-[11.5px] text-text-muted">lecture seule en P1</span>
      <div class="ml-auto flex gap-2">
        <button type="button" class="btn btn-ghost" :disabled="!canGoBack" @click="offset--">
          Précédent
        </button>
        <button type="button" class="btn btn-ghost" :disabled="!canGoForward" @click="offset++">
          Suivant
        </button>
      </div>
    </div>

    <div v-for="week in block" :key="week.id" class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Semaine {{ week.index }}</span>
        <span class="mono text-[11.5px] text-text-muted">
          <template v-if="!plan.awaitingResumption">
            {{ formatDate(week.startDate) }} – {{ formatDate(week.endDate) }} ·
          </template>
          {{ PHASE_LABELS[week.phaseType] ?? week.phaseType }} ·
          {{ formatDistance(week.targetRunM) }}
        </span>
        <span v-if="week.light" class="pill ml-auto">allégée</span>
        <span v-else-if="week.comebackRatio" class="pill pill-warn ml-auto">
          reprise {{ Math.round(week.comebackRatio * 100) }} %
        </span>
      </div>

      <div class="grid grid-cols-7 gap-2">
        <CockpitDayCell
          v-for="day in daysOf(week)"
          :key="day.date"
          :label="day.label"
          :sessions="day.sessions"
          :is-today="day.isToday"
          compact
        />
      </div>
    </div>

    <div v-if="plan.awaitingResumption" class="tile border-dashed">
      <span class="label">En attente de la reprise</span>
      <p class="text-[13px] text-text-muted">
        Les phases et les volumes sont calculés, mais les séances ne seront datées qu'une fois la
        reprise marquée depuis le cockpit.
      </p>
    </div>

    <p v-else-if="block.length === 0" class="text-[13px] text-text-muted">
      Aucun plan actif. Ajoute une course depuis Courses.
    </p>
  </div>
</template>
