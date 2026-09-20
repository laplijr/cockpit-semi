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
    <section class="grid grid-cols-2 gap-4 wide:grid-cols-[1.15fr_1fr_1fr_1fr]">
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

    <!-- Les deux tuiles finissent sur la même ligne : « À décider » est borné à
         trois décisions depuis P5.19, l'étirement ne fuit donc plus (§ 8). -->
    <section class="grid grid-cols-1 gap-4 lean:grid-cols-[1.6fr_1fr]">
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
          <!-- La semaine est déjà dans la barre du haut et dans la tuile
               Semaine : elle ne se redit pas ici (§ 8, P6.35). -->
          <span class="mono text-[11.5px] text-text-dim">{{ formatLongDate(plan.today) }}</span>
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
          <CockpitTodaySession
            v-for="session in plan.todaySessions"
            :key="session.id"
            :session="session"
          />
        </template>
        <p v-else class="text-[13px] text-text-dim">Repos aujourd'hui.</p>

        <!-- Demain tient sur une ligne : icône de sport, nom, deux chiffres,
             et le conseil nutrition en pastille (§ 8, P6.35). -->
        <div
          v-if="plan.tomorrowSessions.length > 0"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-3"
        >
          <span class="label text-[10.5px]">Demain</span>
          <span
            v-for="session in plan.tomorrowSessions"
            :key="session.id"
            class="flex items-center gap-2"
          >
            <UiAppIcon
              :name="sportStyle(session.sport).icon"
              :size="15"
              :class="sportStyle(session.sport).tone"
              :label="SPORT_LABELS[session.sport] ?? session.sport"
            />
            <span class="text-[13px]">{{ SESSION_LABELS[session.code] ?? session.code }}</span>
            <span class="mono text-[12px] text-text-dim">
              <template v-if="session.prescription.totalDistanceM > 0">
                {{ formatDistance(session.prescription.totalDistanceM) }} ·
              </template>
              {{ formatMinutes(prescribedMinutes(session.prescription)) }}
            </span>
          </span>
          <CockpitNutritionPill class="ml-auto" />
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
