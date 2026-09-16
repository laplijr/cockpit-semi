<script setup lang="ts">
const plan = usePlanStore()
const { data: races, refresh: refreshRaces } = await useFetch('/api/races')

const proposals = usePropositionsStore()

await Promise.all([plan.ensureLoaded(), proposals.load()])

const raceA = computed(() =>
  (races.value ?? [])
    .filter((race) => race.priority === 'A' && race.status === 'planifiee')
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(0),
)

const upcoming = computed(() =>
  (races.value ?? [])
    .filter((race) => race.status === 'planifiee')
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const vdot = computed(() => {
  const parameters = plan.plan?.version.parameters as { vdot?: number } | undefined
  return parameters?.vdot ?? null
})

const vdotIsFloor = computed(() => {
  const parameters = plan.plan?.version.parameters as { vdotIsFloor?: boolean } | undefined
  return parameters?.vdotIsFloor ?? true
})

const currentWeekSessions = computed(() =>
  plan.currentWeek ? (plan.sessionsByWeek.get(plan.currentWeek.id) ?? []) : [],
)

async function onResume() {
  await refreshRaces()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="grid grid-cols-4 gap-4">
      <CockpitRaceDial :race="raceA" :today="plan.today" />
      <CockpitVdotDial :vdot="vdot" :is-floor="vdotIsFloor" />
      <CockpitLoadDial />
      <CockpitReadinessDial />
    </section>

    <section class="grid grid-cols-[1.6fr_1fr] gap-4">
      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Aujourd'hui</span>
          <span class="mono text-[11.5px] text-text-muted">{{ formatLongDate(plan.today) }}</span>
        </div>

        <template v-if="plan.awaitingResumption">
          <p class="text-[13px] text-text-dim">
            Le plan est calculé — phases, volumes, cap — mais il n'est pas daté : les séances
            apparaîtront quand tu marqueras la reprise.
          </p>
        </template>
        <template v-else-if="plan.pause">
          <p class="text-[13px] text-text-dim">
            Aucune séance de course tant que la pause est ouverte.
          </p>
        </template>
        <template v-else-if="plan.todaySessions.length > 0">
          <CockpitSessionRow
            v-for="session in plan.todaySessions"
            :key="session.id"
            :session="session"
            actionable
          />
        </template>
        <p v-else class="text-[13px] text-text-muted">Repos aujourd'hui.</p>

        <div v-if="plan.tomorrowSessions.length > 0" class="border-t border-line-soft pt-3">
          <span class="label text-[10.5px]">Demain</span>
          <CockpitSessionRow
            v-for="session in plan.tomorrowSessions"
            :key="session.id"
            :session="session"
            muted
          />
        </div>
      </div>

      <CockpitPauseCard v-if="plan.pause" :pause="plan.pause" @resume="onResume" />
      <CockpitDecisionList v-else />
    </section>

    <CockpitWeekStrip
      :week="plan.currentWeek"
      :sessions="currentWeekSessions"
      :today="plan.today"
    />

    <CockpitSeasonTimeline
      v-if="plan.plan"
      :phases="plan.plan.phases"
      :weeks="plan.plan.weeks"
      :races="upcoming"
      :today="plan.today"
    />
  </div>
</template>
