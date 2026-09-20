<script setup lang="ts">
import type { DialId } from '~/stores/ui'
import type { GlossaryTerm } from '~/utils/glossary'

const props = defineProps<{ dial: DialId }>()

const plan = usePlanStore()
const { data: load } = await useFetch('/api/load')
const { data: readiness } = await useFetch('/api/readiness')
const { data: library } = await useFetch('/api/library/running')
const { data: races } = await useFetch('/api/races')
const { data: progression } = await useFetch('/api/progression')

const KEY_SESSION_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Séance', term: 'seanceCle' },
  { label: 'Distance' },
  { label: 'RPE prévu', term: 'rpe' },
  { label: 'RPE réel' },
  { label: 'Statut' },
]

const ORIGIN_LABELS: Record<string, string> = {
  course: 'Course',
  test: 'Test 20′',
  import_initial: 'Import',
}

const OBJECTIVE_LEVELS = [
  { label: 'Ambition', field: 'objectifAmbitionS', confidence: 'confidenceAmbitionPct' },
  { label: 'Réaliste', field: 'objectifS', confidence: 'confidencePct' },
  { label: 'Plancher', field: 'objectifPlancherS', confidence: 'confidencePlancherPct' },
] as const

const SPORTS = [
  { key: 'course', label: 'Course' },
  { key: 'velo', label: 'Vélo' },
  { key: 'muscu', label: 'Renforcement' },
  { key: 'autre', label: 'Autre' },
] as const

/**
 * Les deux journaux du dialog grandissent sans fin — un point de forme par
 * course ou par test, deux à trois séances clés par semaine. Le journal des
 * clés tenait 2840 px sur quarante lignes : ils se lisent dix par dix (§ 8).
 */
const PER_PAGE = 10
const vdotPoints = usePagedList(() => progression.value?.vdot ?? [], PER_PAGE)
const keySessions = usePagedList(() => progression.value?.keySessions ?? [], PER_PAGE)

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

/**
 * La dernière échéance confrontée au réalisé. Une ligne ici, le détail dans
 * Progression : le cockpit ne gagne rien à plat (§ 9, P6.6).
 */
const lastForecast = computed(() => progression.value?.forecasts.at(0) ?? null)

/** Un VDOT garde sa décimale, même nulle, comme partout ailleurs. */
const vdotText = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toFixed(1).replace('.', ',')

const signedVdot = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${vdotText(value)}`

const title = computed(
  () =>
    ({
      'course-a': 'Course A',
      forme: 'Forme du jour',
      charge: 'Charge combinée',
      vdot: 'VDOT',
      adherence: 'Adhérence',
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
          <span class="mono text-[12px] text-text-dim">
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

      <p class="text-[13px] text-text-dim">
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
          <span v-if="!readiness?.causes.length" class="text-[13px] text-text-dim">
            Aucun signal particulier.
          </span>
        </div>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Pour demain</span>
        <p class="text-[13px] text-text-dim">{{ readiness?.suggestion }}</p>
      </div>

      <p class="text-[13px] text-text-dim">
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
          <span v-if="library?.vdotIsFloor" class="text-[12px] text-text-dim">
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

      <p v-if="lastForecast" class="text-[13px] text-text-dim">
        Dernière prévision confrontée : {{ lastForecast.label }} du
        {{ formatDate(lastForecast.targetDate) }}, annoncé à
        {{ vdotText(lastForecast.projectedVdot) }} et réalisé à
        {{ vdotText(lastForecast.actualVdot) }} — écart de
        {{ signedVdot(lastForecast.gapVdot) }} VDOT.
      </p>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Allures d'entraînement</span>
        <div class="grid grid-cols-5 gap-3">
          <div v-for="zone in library?.zones ?? []" :key="zone.key" class="flex flex-col">
            <span class="label text-[10px]">{{ zone.label }}</span>
            <span class="mono text-[15px]">{{ formatPace(zone.paceSecPerKm) }}</span>
          </div>
        </div>
        <span class="mono text-[12px] text-text-dim">
          Allure semi : {{ formatPace(library?.halfPaceSecPerKm) }}/km
        </span>
      </div>

      <!-- L'historique complet : Progression n'en montre que les trois derniers
           points, le détail vit ici (§ 8, P6.35). -->
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Tous les points de forme</span>
        <UiAxisScroller>
          <table class="table-axis w-full text-[13px]">
            <thead>
              <tr class="text-left">
                <th
                  v-for="head in ['Date', 'Origine', 'VDOT', 'Projection semi']"
                  :key="head"
                  class="label pb-2 text-[10px]"
                >
                  {{ head }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="point in vdotPoints.items"
                :key="point.date"
                class="border-t border-line-soft"
              >
                <td class="mono py-[6px]">{{ formatDate(point.date) }}</td>
                <td class="py-[6px]">
                  {{ ORIGIN_LABELS[point.origin] ?? point.origin }}
                  <span v-if="point.isFloor" class="pill pill-warn ml-1">plancher</span>
                </td>
                <td class="mono py-[6px]">{{ point.vdot.toFixed(1).replace('.', ',') }}</td>
                <td class="mono py-[6px] text-text-dim">
                  {{ formatDuration(point.halfProjectionS) }}
                </td>
              </tr>
            </tbody>
          </table>
        </UiAxisScroller>

        <UiPager v-model="vdotPoints.page" :total="vdotPoints.total" :per-page="PER_PAGE" />
      </div>
    </template>

    <!--
      Le détail de l'adhérence, ce sont les séances elles-mêmes : le cadran dit
      « 93 % des séances prévues » sans jamais dire lesquelles (§ 9, P6.5).
    -->
    <template v-else-if="dial === 'adherence'">
      <div class="grid grid-cols-2 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Séances prévues réalisées</span>
          <span class="display text-[32px] font-bold">
            {{ progression?.adherence === null ? '—' : `${progression?.adherence} %` }}
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Séances clés sur la période</span>
          <span class="mono text-[20px]">{{ progression?.keySessions.length ?? 0 }}</span>
        </div>
      </div>

      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Journal des séances clés</span>
        <UiAxisScroller>
          <table class="table-axis w-full text-[13px]">
            <thead>
              <tr class="text-left">
                <th
                  v-for="head in KEY_SESSION_COLUMNS"
                  :key="head.label"
                  class="label pb-2 text-[10px]"
                >
                  <UiInfoHint v-if="head.term" :term="head.term">{{ head.label }}</UiInfoHint>
                  <template v-else>{{ head.label }}</template>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in keySessions.items"
                :key="item.id"
                class="border-t border-line-soft"
              >
                <td class="mono py-[6px]">{{ formatDate(item.date) }}</td>
                <td class="py-[6px]">{{ SESSION_LABELS[item.code] ?? item.code }}</td>
                <td class="mono py-[6px] text-text-dim">{{ formatDistance(item.distanceM) }}</td>
                <td class="mono py-[6px] text-text-dim">{{ item.expectedRpe ?? '—' }}</td>
                <td
                  class="mono py-[6px]"
                  :class="
                    item.rpe !== null && item.expectedRpe !== null && item.rpe > item.expectedRpe
                      ? 'text-warn'
                      : ''
                  "
                >
                  {{ item.rpe ?? '—' }}
                </td>
                <td class="py-[6px]">
                  <span class="pill" :class="item.status === 'faite' ? 'pill-done' : ''">
                    {{ item.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="keySessions.total === 0">
                <td colspan="6" class="py-3 text-text-dim">
                  Aucune séance clé encore planifiée ou réalisée.
                </td>
              </tr>
            </tbody>
          </table>
        </UiAxisScroller>

        <UiPager v-model="keySessions.page" :total="keySessions.total" :per-page="PER_PAGE" />
      </div>
    </template>

    <template v-else-if="dial === 'course-a' && raceA">
      <div class="grid grid-cols-3 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">{{ raceA.name }}</span>
          <span class="display text-[32px] font-bold text-accent">
            J−{{ daysUntil(raceA.date, plan.today) }}
          </span>
          <span class="mono text-[12px] text-text-dim">{{ formatLongDate(raceA.date) }}</span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Objectif</span>
          <span class="mono text-[20px]">
            <template v-if="raceA.objectiveToSet">à fixer</template>
            <template v-else-if="raceA.objectiveMode === 'record'">
              {{ formatDuration(raceA.recordS) }}
            </template>
            <template v-else>{{ formatDuration(raceA.objectifS) }}</template>
          </span>
          <span v-if="raceA.objectiveMode === 'record'" class="text-[12px] text-text-dim">
            record · {{ raceA.recordName }} ·
            {{ raceA.recordDate ? formatDate(raceA.recordDate) : '—' }}
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Projection</span>
          <span class="mono text-[20px]">{{ formatDuration(raceA.projectionS) }}</span>
          <span class="mono text-[12px] text-text-dim">
            {{ formatDuration(raceA.projectionLowS) }} – {{ formatDuration(raceA.projectionHighS) }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Confiance</span>
          <span class="mono text-[20px]">
            {{ raceA.confidencePct === null ? '—' : `${raceA.confidencePct} %` }}
          </span>
          <span class="text-[12px] text-text-dim">
            <template v-if="raceA.confidencePct === null">
              Sans objectif ni référence à battre, il n'y a rien à estimer.
            </template>
            <template v-else-if="raceA.objectiveMode === 'record'">
              probabilité de battre ton record sur la distance
            </template>
            <template v-else>probabilité de tenir le niveau réaliste</template>
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Dénivelé attendu</span>
          <span class="mono text-[20px]">
            {{ raceA.elevationGainM === null ? '—' : `${raceA.elevationGainM} m` }}
          </span>
          <span class="text-[12px] text-text-dim">une demi-seconde par mètre</span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Température attendue</span>
          <span class="mono text-[20px]">
            {{ raceA.expectedTempC === null ? '—' : `${raceA.expectedTempC} °C` }}
          </span>
          <span class="text-[12px] text-text-dim">1,5 % par degré au-dessus de 18</span>
        </div>
      </div>

      <!-- Les trois niveaux se lisent ensemble : un curseur de risque, pas trois verdicts. -->
      <div
        v-if="raceA.objectiveMode === 'temps' && !raceA.objectiveToSet"
        class="tile bg-surface-inset"
      >
        <span class="label text-[10.5px]">Les trois niveaux</span>
        <div class="grid grid-cols-3 gap-4">
          <div v-for="level in OBJECTIVE_LEVELS" :key="level.label" class="flex flex-col">
            <span class="label text-[10px]">{{ level.label }}</span>
            <span class="mono text-[17px]">{{ formatDuration(raceA[level.field]) }}</span>
            <span class="mono text-[12px] text-text-dim">
              {{ raceA[level.confidence] === null ? '—' : `${raceA[level.confidence]} %` }}
            </span>
          </div>
        </div>
        <span class="text-[12px] text-text-dim">
          Du plus ambitieux au plus sûr : plus le chrono s'accorde de temps, plus la confiance
          monte. Un seul des trois est « l'objectif » — le réaliste.
        </span>
      </div>

      <p class="text-[13px] text-text-dim">
        La projection part de ton VDOT du jour, y ajoute le gain attendu d'ici la course —
        {{ formatDecimal(progression?.gainPerBlock, 2) }} VDOT par tranche de huit semaines
        d'entraînement, rien pour les semaines en pause — puis corrige du dénivelé et de la chaleur.
        L'intervalle vient de la variabilité de tes tests ; la confiance en découle.
        <template v-if="plan.nextTestWeek">
          Prochain test en semaine {{ plan.nextTestWeek.index }}.
        </template>
      </p>
    </template>
  </div>
</template>
