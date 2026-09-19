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

const { data } = await useFetch('/api/progression', {
  query: { period },
})

/** La courbe promise par le § 8 : la table reste dessous, elle donne le détail. */
const vdotCurve = computed(() =>
  (data.value?.vdot ?? []).map((point) => ({ date: point.date, value: point.vdot })),
)

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

/** La table ne garde que les trois derniers points : le reste vit dans le dialog du cadran. */
const recentVdot = computed(() => (data.value?.vdot ?? []).slice(-3))

const VDOT_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Origine' },
  { label: 'VDOT', term: 'vdot' },
  { label: 'Projection semi', term: 'projection' },
]

const ORIGIN_LABELS: Record<string, string> = {
  course: 'Course',
  test: 'Test 20′',
  import_initial: 'Import',
}

const visibleWeeks = computed(() => (data.value?.weeks ?? []).slice(0, 24))

const counters = computed(() => data.value?.counters ?? null)

/** Le dénivelé n'a pas encore de source : le compteur s'efface plutôt que d'afficher zéro. */
const hasElevation = computed(() => (counters.value?.elevationGainM ?? 0) > 0)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Le filtre commande toute la page : il se pose avant ce qu'il filtre. -->
    <div class="flex items-center gap-2">
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
    <section class="grid grid-cols-3 gap-4">
      <button type="button" class="tile dial tile-action text-left" @click="ui.openDial('vdot')">
        <span class="label">Forme mesurée <UiInfoHint term="vdot" /></span>

        <span
          class="display text-[56px] leading-none font-bold"
          :class="{ 'text-warn': lastVdot?.isFloor, 'text-text-dim': !lastVdot }"
        >
          {{ lastVdot ? lastVdot.vdot.toFixed(1).replace('.', ',') : '—' }}
        </span>

        <span class="mono text-[11.5px] text-text-dim">
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
        <span class="label">Adhérence <UiInfoHint term="adherence" /></span>

        <span
          class="display text-[56px] leading-none font-bold"
          :class="data?.adherence === null && 'text-text-dim'"
        >
          {{ data?.adherence === null ? '—' : `${data?.adherence} %` }}
        </span>

        <span class="mono text-[11.5px] text-text-dim">des séances prévues</span>

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
        <span class="label"
          >Propositions acceptées <UiInfoHint term="propositionsAcceptees"
        /></span>

        <span
          class="display text-[56px] leading-none font-bold"
          :class="data?.acceptanceRate === null && 'text-text-dim'"
        >
          {{ data?.acceptanceRate === null ? '—' : `${data?.acceptanceRate} %` }}
        </span>

        <span class="mono text-[11.5px] text-text-dim">des décisions prises</span>

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

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Forme et confiance</span>
        <!-- La table ne garde que les trois derniers points ; l'historique
             complet vit dans le dialog du cadran (§ 8, P6.35). -->
        <button
          v-if="(data?.vdot.length ?? 0) > recentVdot.length"
          type="button"
          class="mono ml-auto text-[11.5px] text-accent"
          @click="ui.openDial('vdot')"
        >
          voir les {{ data?.vdot.length }} points
        </button>
      </div>

      <ProgressionFormChart
        :vdot="vdotCurve"
        :confidence="data?.confidence ?? []"
        :race-name="data?.confidenceRace?.name ?? null"
      />

      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th v-for="head in VDOT_COLUMNS" :key="head.label" class="label pb-2 text-[10px]">
              {{ head.label }}
              <UiInfoHint v-if="head.term" :term="head.term" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in recentVdot" :key="point.date" class="border-t border-line-soft">
            <td class="mono py-[6px]">{{ formatDate(point.date) }}</td>
            <td class="py-[6px]">
              {{ ORIGIN_LABELS[point.origin] ?? point.origin }}
              <span v-if="point.isFloor" class="pill pill-warn ml-1">plancher</span>
            </td>
            <td class="mono py-[6px]">{{ point.vdot.toFixed(1).replace('.', ',') }}</td>
            <td class="mono py-[6px] text-text-dim">{{ formatDuration(point.halfProjectionS) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Volume visé et charge par semaine <UiInfoHint term="ua" /></span>
        <span class="mono text-[11.5px] text-text-dim">24 premières semaines</span>
      </div>
      <UiWeekBars
        :weeks="visibleWeeks"
        :legend="{ volume: 'volume visé', load: 'charge enregistrée' }"
      />
    </div>

    <section class="grid grid-cols-2 gap-4">
      <div class="tile">
        <span class="label">Records <UiInfoHint term="record" /></span>

        <p v-if="(data?.records.length ?? 0) === 0" class="text-[13px] text-text-dim">
          Aucun chrono représentatif : un record se court, il ne s'estime pas.
        </p>

        <div
          v-for="record in data?.records ?? []"
          :key="record.distance"
          class="flex items-baseline gap-3 border-t border-line-soft py-[6px] first:border-t-0"
        >
          <span class="text-[13px]">{{ record.distance }}</span>
          <span class="mono text-[15px]">{{ formatDuration(record.timeS) }}</span>
          <UiHoverBubble :label="`Équivalences au VDOT de ce record`" class="ml-auto">
            <template #trigger>
              <span class="mono text-[11.5px] text-text-dim">
                {{ formatDate(record.date) }} · VDOT {{ formatDecimal(record.vdot, 1) }}
              </span>
            </template>
            <span class="label text-[10px]">{{ record.name }}</span>
            <span
              v-for="equivalent in record.equivalents"
              :key="equivalent.distance"
              class="mono text-[12px] text-text-dim"
            >
              {{ equivalent.distance }} · {{ formatDuration(equivalent.timeS) }}
            </span>
          </UiHoverBubble>
        </div>
      </div>

      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Depuis la reprise</span>
          <span v-if="data?.resumedOn" class="mono text-[11.5px] text-text-dim">
            {{ formatDate(data.resumedOn) }}
          </span>
        </div>

        <div class="grid gap-3" :class="hasElevation ? 'grid-cols-4' : 'grid-cols-3'">
          <div class="flex flex-col">
            <span class="label text-[10px]">Kilomètres</span>
            <span class="mono text-[17px]">{{ formatDistance(counters?.runM ?? 0) }}</span>
            <span class="mono text-[10.5px] text-text-dim"
              >{{ counters?.sessions ?? 0 }} séances</span
            >
          </div>
          <div v-if="hasElevation" class="flex flex-col">
            <span class="label text-[10px]">Dénivelé</span>
            <span class="mono text-[17px]">{{ counters?.elevationGainM }} m</span>
            <span class="mono text-[10.5px] text-text-dim">cumulé</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Sorties longues</span>
            <span class="mono text-[17px]">{{ counters?.longRuns ?? 0 }}</span>
            <span class="mono text-[10.5px] text-text-dim">depuis la reprise</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Série <UiInfoHint term="serie" /></span>
            <span class="mono text-[17px]">{{ counters?.streak ?? 0 }}</span>
            <span class="mono text-[10.5px] text-text-dim">
              semaine{{ (counters?.streak ?? 0) > 1 ? 's' : '' }} tenue{{
                (counters?.streak ?? 0) > 1 ? 's' : ''
              }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!--
      Deux lectures d'un même sujet — comment le corps encaisse : le sommeil et
      les jours sans rien d'un côté, l'écart entre l'effort prévu et l'effort
      vécu de l'autre. Un seul en-tête (§ 9, P6.5).
    -->
    <div class="tile">
      <span class="label">Ressenti et récupération <UiInfoHint term="recuperation" /></span>

      <div class="grid grid-cols-[1fr_1.2fr] gap-6">
        <div class="grid grid-cols-3 gap-3 self-start">
          <div class="flex flex-col">
            <span class="label text-[10px]">Sommeil moyen</span>
            <span class="mono text-[17px]">
              {{
                data?.recovery.sleepMeanH === null
                  ? '—'
                  : `${formatDecimal(data?.recovery.sleepMeanH, 1)} h`
              }}
            </span>
            <span class="mono text-[10.5px] text-text-dim">
              {{ data?.recovery.samples.nights }} nuits
            </span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Nuits courtes</span>
            <span
              class="mono text-[17px]"
              :class="(data?.recovery.shortNightShare ?? 0) > 0.25 && 'text-warn'"
            >
              {{
                data?.recovery.shortNightShare === null
                  ? '—'
                  : `${Math.round((data?.recovery.shortNightShare ?? 0) * 100)} %`
              }}
            </span>
            <span class="mono text-[10.5px] text-text-dim">
              {{ data?.recovery.shortNights }} sous 6 h
            </span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Jours sans rien</span>
            <span class="mono text-[17px]">
              {{ formatDecimal(data?.recovery.restDaysPerWeek, 1) }}
            </span>
            <span class="mono text-[10.5px] text-text-dim">par semaine</span>
          </div>
        </div>

        <div class="flex flex-col border-l border-line-soft pl-6">
          <span class="label text-[10px]">
            Écart de RPE par séance <UiInfoHint term="calibration" />
          </span>

          <p v-if="(data?.rpeCalibration.length ?? 0) === 0" class="text-[13px] text-text-dim">
            Aucun ressenti sur la période.
          </p>

          <div
            v-for="row in data?.rpeCalibration ?? []"
            :key="row.code"
            class="flex items-baseline gap-3 border-t border-line-soft py-[5px] first:border-t-0"
          >
            <span class="text-[13px]">{{ SESSION_LABELS[row.code] ?? row.code }}</span>
            <span
              class="mono ml-auto text-[13px]"
              :class="Math.abs(row.bias) >= 0.5 && 'text-warn'"
            >
              {{ row.bias > 0 ? '+' : '' }}{{ formatDecimal(row.bias) }}
            </span>
            <span class="mono w-[70px] text-right text-[11.5px] text-text-dim">
              {{ row.samples }} séance{{ row.samples > 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="(data?.strengthLoads.length ?? 0) > 0" class="tile">
      <span class="label">Charges tenues en renforcement <UiInfoHint term="chargeMuscu" /></span>

      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="series in data?.strengthLoads ?? []"
          :key="series.exerciseId"
          class="flex flex-col gap-1"
        >
          <span class="text-[12.5px]">{{ series.exerciseId }}</span>
          <UiSeriesChart
            :points="series.points.map((point) => ({ date: point.date, value: point.loadKg }))"
            :height="72"
            unit=" kg"
            :decimals="0"
          />
        </div>
      </div>
    </div>
  </div>
</template>
