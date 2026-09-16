<script setup lang="ts">
import type { DialId } from '~/stores/ui'

const props = defineProps<{ dial: DialId }>()

const plan = usePlanStore()
const { data: load } = await useFetch('/api/load')
const { data: readiness } = await useFetch('/api/readiness')
const { data: library } = await useFetch('/api/library/running')
const { data: races } = await useFetch('/api/races')

const SPORTS = [
  { key: 'course', label: 'Course' },
  { key: 'velo', label: 'Vélo' },
  { key: 'muscu', label: 'Muscu' },
  { key: 'autre', label: 'Autre' },
] as const

const raceA = computed(() =>
  (races.value ?? [])
    .filter((race) => race.priority === 'A' && race.status === 'planifiee')
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(0),
)

const vdot = computed(() => {
  const parameters = plan.plan?.version.parameters as { vdot?: number } | undefined
  return parameters?.vdot ?? null
})

const title = computed(
  () =>
    ({
      'course-a': 'Course A',
      forme: 'Forme du jour',
      charge: 'Charge combinée',
      vdot: 'VDOT',
    })[props.dial],
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <span class="display text-[22px] font-semibold">{{ title }}</span>

    <template v-if="dial === 'charge'">
      <div class="grid grid-cols-3 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Ratio 7 j / 21 j</span>
          <span class="display text-[32px] font-bold">
            {{ load?.ratio ? load.ratio.ratio.toFixed(2).replace('.', ',') : '—' }}
          </span>
          <span class="mono text-[12px] text-text-muted">
            repère {{ load?.reference.low }}–{{ load?.reference.high }}
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Sept derniers jours</span>
          <span class="mono text-[20px]">{{ load?.ratio?.acute ?? '—' }} UA</span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Vingt-et-un jours précédents</span>
          <span class="mono text-[20px]">{{ load?.ratio?.chronic ?? '—' }} UA</span>
        </div>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Répartition de la semaine</span>
        <div class="grid grid-cols-4 gap-4">
          <div v-for="sport in SPORTS" :key="sport.key" class="flex flex-col">
            <span class="label text-[10px]">{{ sport.label }}</span>
            <span class="mono text-[17px]">{{ load?.weekBySport[sport.key] ?? 0 }} UA</span>
          </div>
        </div>
      </div>

      <p class="text-[13px] text-text-muted">
        La charge se compte en unités arbitraires : RPE × durée en minutes, pour tous les sports. Le
        ratio compare les sept derniers jours à la moyenne des vingt-et-un précédents, sans
        recouvrement. C'est un repère, jamais une décision à lui seul.
        <template v-if="load?.monotony"> Monotonie de la semaine : {{ load.monotony }}. </template>
      </p>
    </template>

    <template v-else-if="dial === 'forme'">
      <div class="grid grid-cols-2 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Score</span>
          <span class="display text-[32px] font-bold">{{ readiness?.score ?? '—' }}</span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Causes</span>
          <span
            v-for="cause in readiness?.causes ?? []"
            :key="cause"
            class="text-[13px] text-text-dim"
          >
            {{ cause }}
          </span>
          <span v-if="!readiness?.causes.length" class="text-[13px] text-text-muted">
            Aucun signal particulier.
          </span>
        </div>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Pour demain</span>
        <p class="text-[13px] text-text-dim">{{ readiness?.suggestion }}</p>
      </div>

      <p class="text-[13px] text-text-muted">
        Le score pèse le sommeil déclaré pour 35 %, l'écart de RPE des trois dernières séances pour
        30 %, les sensations pour 20 % et le ratio de charge pour 15 %. Prêt au-dessus de 65,
        vigilance entre 40 et 64, repos en dessous.
      </p>
    </template>

    <template v-else-if="dial === 'vdot'">
      <div class="grid grid-cols-2 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Valeur courante</span>
          <span class="display text-[32px] font-bold">
            {{ vdot === null ? '—' : vdot.toFixed(1).replace('.', ',') }}
          </span>
          <span v-if="library?.vdotIsFloor" class="text-[12px] text-text-muted">
            Plancher déduit du meilleur segment continu, pas une mesure.
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Prochain test 20′</span>
          <span class="mono text-[17px]">
            <template v-if="plan.nextTestWeek">
              semaine {{ plan.nextTestWeek.index }}
              <template v-if="!plan.awaitingResumption">
                · {{ formatDate(plan.nextTestWeek.startDate) }}
              </template>
            </template>
            <template v-else>à la reprise</template>
          </span>
        </div>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Allures d'entraînement</span>
        <div class="grid grid-cols-5 gap-3">
          <div v-for="zone in library?.zones ?? []" :key="zone.key" class="flex flex-col">
            <span class="label text-[10px]">{{ zone.label }}</span>
            <span class="mono text-[15px]">{{ formatPace(zone.paceSecPerKm) }}</span>
          </div>
        </div>
        <span class="mono text-[12px] text-text-muted">
          Allure semi : {{ formatPace(library?.halfPaceSecPerKm) }}/km
        </span>
      </div>
    </template>

    <template v-else-if="dial === 'course-a' && raceA">
      <div class="grid grid-cols-3 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">{{ raceA.name }}</span>
          <span class="display text-[32px] font-bold text-accent">
            J−{{ daysUntil(raceA.date, plan.today) }}
          </span>
          <span class="mono text-[12px] text-text-muted">{{ formatLongDate(raceA.date) }}</span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Objectif</span>
          <span class="mono text-[20px]">
            <template v-if="raceA.objectiveToSet">à fixer</template>
            <template v-else-if="raceA.objectiveMode === 'performance_max'">
              performance max
            </template>
            <template v-else>{{ formatDuration(raceA.objectifS) }}</template>
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Projection</span>
          <span class="mono text-[20px]">{{ formatDuration(raceA.projectionS) }}</span>
          <span v-if="raceA.projectionIsFloor" class="text-[12px] text-text-muted">
            calculée sur le plancher
          </span>
        </div>
      </div>

      <p class="text-[13px] text-text-muted">
        La projection est l'équivalence de ton VDOT courant sur la distance. Elle sera revue à
        chaque test 20′ et après chaque course représentative.
      </p>
    </template>
  </div>
</template>
