<script setup lang="ts">
const plan = usePlanStore()
const proposals = usePropositionsStore()

/**
 * Rien n'est attendu avant le rendu : le cockpit se peint tout de suite et
 * chaque tuile porte son squelette jusqu'à sa donnée (§ 8, P5.20).
 */
const {
  data: races,
  status: racesStatus,
  refresh: refreshRaces,
} = useFetch('/api/races', { lazy: true, server: false })

onMounted(() => {
  proposals.load()
})

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
    <!-- Course A est le seul cadran qui est un but, pas une mesure (§ 9, P5.19). -->
    <section class="grid grid-cols-[1.15fr_1fr_1fr_1fr] gap-4">
      <!-- Le décompte se compte depuis aujourd'hui : sans le plan, pas de J−. -->
      <CockpitRaceDial
        :race="raceA"
        :today="plan.today"
        :loading="isLoading(racesStatus) || !plan.loaded"
      />
      <CockpitVdotDial :vdot="vdot" :is-floor="vdotIsFloor" :loading="!plan.loaded" />
      <CockpitLoadDial />
      <CockpitReadinessDial />
    </section>

    <!-- `items-start` : la tuile cesse de s'étirer à la hauteur de « À décider ». -->
    <section class="grid grid-cols-[1.6fr_1fr] items-start gap-4">
      <!-- Une seule ligne de séance en squelette : c'est la journée courante. -->
      <div v-if="!plan.loaded" class="tile" aria-busy="true">
        <div class="flex items-baseline gap-3">
          <span class="label">Aujourd'hui</span>
          <UiSkeleton width="150px" />
          <UiSkeleton class="ml-auto" width="230px" />
        </div>
        <div class="flex items-center gap-3 px-2 py-[10px]">
          <UiSkeleton variant="block" :height="18" width="18px" class="rounded-sm" />
          <div class="flex flex-1 flex-col gap-px">
            <UiSkeleton :height="22" width="34%" />
            <UiSkeleton :height="16" width="52%" />
          </div>
          <UiSkeleton variant="block" :height="32" width="196px" class="rounded-md" />
        </div>

        <div class="border-t border-line-soft pt-3">
          <span class="label text-[10.5px]">Demain</span>
          <div class="flex items-center gap-3 px-2 py-[10px]">
            <UiSkeleton variant="block" :height="18" width="18px" class="rounded-sm" />
            <div class="flex flex-1 flex-col gap-px">
              <UiSkeleton :height="22" width="28%" />
              <UiSkeleton :height="16" width="46%" />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Aujourd'hui</span>
          <span class="mono text-[11.5px] text-text-muted">{{ formatLongDate(plan.today) }}</span>
          <span v-if="plan.currentWeek" class="mono ml-auto text-[11.5px] text-text-muted">
            semaine {{ plan.currentWeek.index }} ·
            {{ PHASE_LABELS[plan.currentWeek.phaseType] ?? plan.currentWeek.phaseType }} ·
            {{ formatDistance(plan.currentWeek.targetRunM) }} visés
          </span>
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
      <CockpitDecisionList v-else :limit="3" />
    </section>

    <CockpitWeekStrip
      :week="plan.currentWeek"
      :sessions="currentWeekSessions"
      :today="plan.today"
      :loading="!plan.loaded"
    />

    <CockpitSeasonTimeline
      :phases="plan.plan?.phases ?? []"
      :weeks="plan.plan?.weeks ?? []"
      :races="upcoming"
      :today="plan.today"
      :dated="!plan.awaitingResumption"
      :loading="!plan.loaded"
    />
  </div>
</template>
