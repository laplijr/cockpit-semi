<script setup lang="ts">
import type { GlossaryTerm } from '~/utils/glossary'

/** Fenêtre de lecture : le bloc en cours, la saison, ou tout (§ 9, P6). */
const PERIODS = [
  { value: 'bloc', label: '8 semaines' },
  { value: 'saison', label: '6 mois' },
  { value: 'tout', label: 'Tout' },
] as const

const period = ref<(typeof PERIODS)[number]['value']>('tout')

const ui = useUiStore()

/* `lazy` : la navigation n'attend plus la réponse. Sans lui, Vue suspendait
   le changement de route et l'écran restait sur la page précédente, sans
   rien qui dise qu'un chargement était parti. Un changement de période ne
   vide pas `data` : le filtre ne clignote qu'à la toute première ouverture. */
const { data } = useFetch('/api/progression', {
  query: { period },
  lazy: true,
})

/** La charge prolongée jusqu'au jour J : une lecture du plan, pas du filtre (P22). */
const { data: load } = useFetch('/api/load', { lazy: true, server: false })

/** Le bilan ne dépend pas du filtre de période : il porte sur une semaine. */
const { data: bilan } = useFetch('/api/bilan', { lazy: true })

/** L'échelle du cadran de forme : la même tendance, à la taille d'un instrument. */
const vdotSpark = computed(() => {
  const values = (data.value?.vdot ?? []).map((point) => point.vdot)
  if (values.length < 2) return null

  const low = Math.min(...values) - 0.5
  const span = Math.max(...values) + 0.5 - low

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      return `${x.toFixed(1)},${(20 - ((value - low) / span) * 20).toFixed(1)}`
    })
    .join(' ')
})

const lastVdot = computed(() => data.value?.vdot.at(-1) ?? null)

const causesByDate = computed(() =>
  Object.fromEntries((data.value?.vdot ?? []).map((point) => [point.date, point.cause])),
)

/** La table ne garde que les trois derniers points : le reste vit dans le dialog du cadran. */
const recentVdot = computed(() => (data.value?.vdot ?? []).slice(-3))

const VDOT_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Cause' },
  { label: 'VDOT', term: 'vdot' },
  { label: 'Projection semi', term: 'projection' },
  { label: 'Confiance', term: 'confiance' },
]

/**
 * La confiance de ce point-là, et non celle d'aujourd'hui : la trajectoire est
 * construite sur les mêmes points de forme, elle se retrouve par sa date
 * (§ 9, P6.40).
 */
const confidenceAt = (date: string) =>
  data.value?.confidence.find((point) => point.date === date)?.confidencePct ?? null

/** La tuile en montre vingt-quatre : c'est le numéro de semaine qui le dit. */
const visibleWeeks = computed(() => (data.value?.weeks ?? []).slice(0, 24))
const WEEK_LABEL_EVERY = 4

const counters = computed(() => data.value?.counters ?? null)

/**
 * Une liste qui s'allonge. Elle défilait dans sa tuile ; elle se feuillette
 * maintenant, comme partout ailleurs (§ 8) : une tuile garde sa hauteur, et le
 * pied dit sur combien on lit.
 */
const STRENGTH_PER_PAGE = 6

const strengthLoads = usePagedList(() => data.value?.strengthLoads ?? [], STRENGTH_PER_PAGE)

/** Le dénivelé n'a pas encore de source : le compteur s'efface plutôt que d'afficher zéro. */
const hasElevation = computed(() => (counters.value?.elevationGainM ?? 0) > 0)
</script>

<template>
  <div v-if="data" class="flex flex-col gap-4">
    <!-- Le filtre commande toute la page : il se pose avant ce qu'il filtre. -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="label">Période</span>
      <button
        v-for="option in PERIODS"
        :key="option.value"
        type="button"
        class="btn btn-ghost"
        :class="period === option.value && 'border-accent text-accent'"
        @click="period = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Les trois KPI sont des instruments : chiffre à 56 px, une métadonnée,
         une échelle qui le situe (§ 8, P6.35). -->
    <section class="fold-3 grid gap-4">
      <button type="button" class="tile dial tile-action text-left" @click="ui.openDial('vdot')">
        <span class="label"><UiInfoHint term="vdot">Forme mesurée</UiInfoHint></span>

        <span
          class="display text-display-xl leading-none font-bold"
          :class="{ 'text-warn': lastVdot?.isFloor, 'text-text-dim': !lastVdot }"
        >
          {{ lastVdot ? lastVdot.vdot.toFixed(1).replace('.', ',') : '—' }}
        </span>

        <span class="mono text-meta text-text-dim">
          {{ data?.vdot.length ?? 0 }} point{{ (data?.vdot.length ?? 0) > 1 ? 's' : '' }} ·
          {{ lastVdot?.isFloor ? 'plancher' : 'mesure' }}
        </span>

        <svg
          v-if="vdotSpark"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          class="h-[14px] w-full"
          aria-hidden="true"
        >
          <polyline
            :points="vdotSpark"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="1.5"
            vector-effect="non-scaling-stroke"
            stroke-linejoin="round"
          />
        </svg>
        <span v-else class="block h-[14px]"><span class="mt-[6px] block h-px bg-line" /></span>
      </button>

      <button
        type="button"
        class="tile dial tile-action text-left"
        @click="ui.openDial('adherence')"
      >
        <span class="label"><UiInfoHint term="adherence">Adhérence</UiInfoHint></span>

        <span
          class="display text-display-xl leading-none font-bold"
          :class="data?.adherence === null && 'text-text-dim'"
        >
          {{ data?.adherence === null ? '—' : `${data?.adherence} %` }}
        </span>

        <span class="mono text-meta text-text-dim">des séances prévues</span>

        <!-- L'échelle situe le chiffre : 0 à 100 %, repère à la valeur. -->
        <span class="relative block h-[14px]">
          <span class="absolute inset-x-0 top-[6px] h-[3px] rounded-sm bg-accent-track" />
          <span
            v-if="data?.adherence !== null"
            class="absolute top-[6px] h-[3px] rounded-sm bg-accent"
            :style="{ width: `${data?.adherence}%` }"
          />
        </span>
      </button>

      <div class="tile dial">
        <span class="label">
          <UiInfoHint term="propositionsAcceptees">Propositions acceptées</UiInfoHint>
        </span>

        <span
          class="display text-display-xl leading-none font-bold"
          :class="data?.acceptanceRate === null && 'text-text-dim'"
        >
          {{ data?.acceptanceRate === null ? '—' : `${data?.acceptanceRate} %` }}
        </span>

        <span class="mono text-meta text-text-dim">des décisions prises</span>

        <span class="relative block h-[14px]">
          <span class="absolute inset-x-0 top-[6px] h-[3px] rounded-sm bg-accent-track" />
          <span
            v-if="data?.acceptanceRate !== null"
            class="absolute top-[6px] h-[3px] rounded-sm bg-accent"
            :style="{ width: `${data?.acceptanceRate}%` }"
          />
        </span>
      </div>
    </section>

    <!-- La semaine qui vient de finir se referme ici, pas sur le cockpit : le
         § 11 vaut, l'écran principal ne gagne pas une tuile pour ça. -->
    <ProgressionWeeklyReview v-if="bilan?.review" :review="bilan.review" />

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Projection et confiance</span>
        <!-- La table ne garde que les trois derniers points ; l'historique
             complet vit dans le dialog du cadran (§ 8, P6.35). -->
        <button
          v-if="(data?.vdot.length ?? 0) > recentVdot.length"
          type="button"
          class="tap mono ml-auto inline-flex items-center justify-end text-meta text-accent"
          @click="ui.openDial('vdot')"
        >
          voir les {{ data?.vdot.length }} points
        </button>
      </div>

      <ProgressionProjectionChart
        :points="data?.confidence ?? []"
        :race-name="data?.confidenceRace?.name ?? null"
        :causes="causesByDate"
      />

      <UiAxisScroller>
        <table class="table-axis w-full text-body">
          <thead>
            <tr class="text-left">
              <th v-for="head in VDOT_COLUMNS" :key="head.label" class="label pb-2 text-caption">
                <UiInfoHint v-if="head.term" :term="head.term">{{ head.label }}</UiInfoHint>
                <template v-else>{{ head.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in recentVdot" :key="point.date" class="border-t border-line-soft">
              <td class="mono py-[6px]">{{ formatDate(point.date) }}</td>
              <!-- Pourquoi la forme a bougé, à la place de son origine (P22). -->
              <td class="py-[6px] pr-4">
                {{ point.cause }}
                <span v-if="point.isFloor" class="pill pill-warn ml-1">plancher</span>
              </td>
              <td class="mono py-[6px]">{{ point.vdot.toFixed(1).replace('.', ',') }}</td>
              <td class="mono py-[6px] text-text-dim">
                {{ formatDuration(point.halfProjectionS) }}
              </td>
              <td class="mono py-[6px] text-text-dim">
                {{ confidenceAt(point.date) === null ? '—' : `${confidenceAt(point.date)} %` }}
              </td>
            </tr>
          </tbody>
        </table>
      </UiAxisScroller>
    </div>

    <!--
      Trois barres par semaine et rien autour : pas de légende, pas d'ordonnée,
      pas de titre. La bulle de survol porte la lecture (§ 9, P6.39).
    -->
    <div class="tile">
      <!-- Trois barres par semaine sur vingt-six semaines : un axe, pas une
           grille. Il défile au lieu de se comprimer (§ 8, P6.8). -->
      <UiAxisScroller>
        <div class="flex min-w-[520px] flex-col gap-3 lean:min-w-0">
          <span class="label text-caption">
            <UiInfoHint term="chargeProjetee">Ratio 7 j / 21 j</UiInfoHint>
          </span>
          <!-- Le ratio se pose sur les barres, sur le même axe, jusqu'au jour J (P22). -->
          <div class="relative">
            <UiWeekBars :weeks="visibleWeeks" :height="96">
              <template #footer>
                <div class="flex gap-1">
                  <span
                    v-for="(week, index) in visibleWeeks"
                    :key="week.index"
                    class="mono flex-1 text-center text-caption text-text-dim"
                  >
                    <template v-if="index % WEEK_LABEL_EVERY === 0">S{{ week.index }}</template>
                  </span>
                </div>
              </template>
            </UiWeekBars>
            <ProgressionRatioOverlay
              v-if="load?.projection"
              :weeks="visibleWeeks"
              :points="load.projection.points"
              :today="data.today"
              :reference="load.reference"
              :height="100"
            />
          </div>

          <ProgressionIntensityLanes :weeks="visibleWeeks" />
        </div>
      </UiAxisScroller>
    </div>

    <section class="fold-2 grid gap-4">
      <div class="tile">
        <span class="label"><UiInfoHint term="record">Records</UiInfoHint></span>

        <p v-if="(data?.records.length ?? 0) === 0" class="text-body text-text-dim">
          Aucun chrono représentatif.
        </p>

        <div
          v-for="record in data?.records ?? []"
          :key="record.distance"
          class="flex items-baseline gap-3 border-t border-line-soft py-[6px] first:border-t-0"
        >
          <span class="text-body">{{ record.distance }}</span>
          <span class="mono text-copy">{{ formatDuration(record.timeS) }}</span>
          <UiHoverBubble :label="`Équivalences au VDOT de ce record`" class="ml-auto">
            <template #trigger>
              <span class="mono text-meta text-text-dim">
                {{ formatDate(record.date) }} · VDOT {{ formatDecimal(record.vdot, 1) }}
              </span>
            </template>
            <span class="label text-caption">{{ record.name }}</span>
            <span
              v-for="equivalent in record.equivalents"
              :key="equivalent.distance"
              class="mono text-meta text-text-dim"
            >
              {{ equivalent.distance }} · {{ formatDuration(equivalent.timeS) }}
            </span>
          </UiHoverBubble>
        </div>
      </div>

      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Depuis la reprise</span>
          <span v-if="data?.resumedOn" class="mono text-meta text-text-dim">
            {{ formatDate(data.resumedOn) }}
          </span>
        </div>

        <div class="grid gap-3" :class="hasElevation ? 'fold-4' : 'fold-3'">
          <div class="flex flex-col">
            <span class="label text-caption">Kilomètres</span>
            <span class="mono text-title">{{ formatDistance(counters?.runM ?? 0) }}</span>
            <span class="mono text-caption text-text-dim"
              >{{ counters?.sessions ?? 0 }} séances</span
            >
          </div>
          <div v-if="hasElevation" class="flex flex-col">
            <span class="label text-caption">Dénivelé</span>
            <span class="mono text-title">{{ counters?.elevationGainM }} m</span>
            <span class="mono text-caption text-text-dim">cumulé</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-caption">Sorties longues</span>
            <span class="mono text-title">{{ counters?.longRuns ?? 0 }}</span>
            <span class="mono text-caption text-text-dim">depuis la reprise</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-caption"><UiInfoHint term="serie">Série</UiInfoHint></span>
            <span class="mono text-title">{{ counters?.streak ?? 0 }}</span>
            <span class="mono text-caption text-text-dim">
              semaine{{ (counters?.streak ?? 0) > 1 ? 's' : '' }} tenue{{
                (counters?.streak ?? 0) > 1 ? 's' : ''
              }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <ProgressionRecovery
      v-if="data?.recovery"
      :recovery="data.recovery"
      :rpe-calibration="data.rpeCalibration"
    />

    <ProgressionForecasts
      :rows="data?.forecasts ?? []"
      :overall="data?.forecastOverall ?? null"
      :accuracy="data?.forecastAccuracy ?? []"
    />

    <div v-if="strengthLoads.total > 0" class="tile">
      <span class="label"
        ><UiInfoHint term="chargeMuscu">Charges tenues en renforcement</UiInfoHint></span
      >

      <div class="fold-3 grid gap-4">
        <div
          v-for="series in strengthLoads.items"
          :key="series.exerciseId"
          class="flex flex-col gap-1"
        >
          <span class="text-meta">{{ series.label }}</span>
          <UiSeriesChart
            :points="series.points.map((point) => ({ date: point.date, value: point.loadKg }))"
            :height="72"
            unit=" kg"
            :decimals="0"
          />
        </div>
      </div>

      <UiPager
        v-model="strengthLoads.page"
        :total="strengthLoads.total"
        :per-page="STRENGTH_PER_PAGE"
      />
    </div>
  </div>

  <UiPageSkeleton v-else :columns="3" :tiles="3" :lines="4" />
</template>
