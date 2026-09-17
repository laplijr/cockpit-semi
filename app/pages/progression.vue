<script setup lang="ts">
import type { GlossaryTerm } from '~/utils/glossary'

/** Fenêtre de lecture : le bloc en cours, la saison, ou tout (§ 9, P6). */
const PERIODS = [
  { value: 'bloc', label: '8 semaines' },
  { value: 'saison', label: '6 mois' },
  { value: 'tout', label: 'Tout' },
] as const

const period = ref<(typeof PERIODS)[number]['value']>('tout')

const { data } = await useFetch('/api/progression', {
  query: { period },
})

/** La courbe promise par le § 8 : la table reste dessous, elle donne le détail. */
const vdotCurve = computed(() =>
  (data.value?.vdot ?? []).map((point) => ({ date: point.date, value: point.vdot })),
)

const VDOT_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Origine' },
  { label: 'VDOT', term: 'vdot' },
  { label: 'Projection semi', term: 'projection' },
]

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

const visibleWeeks = computed(() => (data.value?.weeks ?? []).slice(0, 24))
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

    <section class="grid grid-cols-3 gap-4">
      <div class="tile">
        <span class="label">Forme mesurée <UiInfoHint term="vdot" /></span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.vdot.at(-1)?.vdot.toFixed(1).replace('.', ',') ?? '—' }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">
          {{ data?.vdot.length ?? 0 }} point{{ (data?.vdot.length ?? 0) > 1 ? 's' : '' }} ·
          {{ data?.vdot.at(-1)?.isFloor ? 'plancher' : 'mesure' }}
        </span>
      </div>

      <div class="tile">
        <span class="label">Adhérence <UiInfoHint term="adherence" /></span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.adherence === null ? '—' : `${data?.adherence} %` }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">séances prévues réalisées</span>
      </div>

      <div class="tile">
        <span class="label">Propositions acceptées</span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.acceptanceRate === null ? '—' : `${data?.acceptanceRate} %` }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">parmi celles décidées</span>
      </div>
    </section>

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">VDOT et projection sur semi</span>
        <span class="mono text-[11.5px] text-text-muted">
          la courbe donne la trajectoire, la table les points
        </span>
      </div>

      <UiSeriesChart :points="vdotCurve" :height="140" />

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
          <tr v-for="point in data?.vdot ?? []" :key="point.date" class="border-t border-line-soft">
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
        <span class="mono text-[11.5px] text-text-muted">24 premières semaines</span>
      </div>
      <UiWeekBars :weeks="visibleWeeks" />

      <span class="mono text-[11px] text-text-muted">
        Barre haute : volume visé. Barre basse : charge enregistrée, en unités arbitraires.
      </span>
    </div>

    <section class="grid grid-cols-2 gap-4">
      <!-- Calibration du ressenti : le tableau du § 8, sans seuil de détection. -->
      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Calibration du ressenti <UiInfoHint term="calibration" /></span>
          <span class="mono text-[11.5px] text-text-muted">RPE vécu moins RPE prescrit</span>
        </div>

        <p v-if="(data?.rpeCalibration.length ?? 0) === 0" class="text-[13px] text-text-muted">
          Aucun ressenti sur la période.
        </p>

        <div
          v-for="row in data?.rpeCalibration ?? []"
          :key="row.code"
          class="flex items-baseline gap-3 border-t border-line-soft py-[6px] first:border-t-0"
        >
          <span class="text-[13px]">{{ SESSION_LABELS[row.code] ?? row.code }}</span>
          <span class="mono ml-auto text-[13px]" :class="Math.abs(row.bias) >= 0.5 && 'text-warn'">
            {{ row.bias > 0 ? '+' : '' }}{{ formatDecimal(row.bias) }}
          </span>
          <span class="mono w-[70px] text-right text-[11.5px] text-text-faint">
            {{ row.samples }} séance{{ row.samples > 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label">Récupération</span>
          <span class="mono text-[11.5px] text-text-muted">sommeil déclaré et jours sans rien</span>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="flex flex-col">
            <span class="label text-[10px]">Sommeil moyen</span>
            <span class="mono text-[17px]">
              {{
                data?.recovery.sleepMeanH === null
                  ? '—'
                  : `${formatDecimal(data?.recovery.sleepMeanH, 1)} h`
              }}
            </span>
            <span class="mono text-[10.5px] text-text-faint">
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
            <span class="mono text-[10.5px] text-text-faint">
              {{ data?.recovery.shortNights }} sous 6 h
            </span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Jours sans rien</span>
            <span class="mono text-[17px]">
              {{ formatDecimal(data?.recovery.restDaysPerWeek, 1) }}
            </span>
            <span class="mono text-[10.5px] text-text-faint">par semaine</span>
          </div>
        </div>
      </div>
    </section>

    <div v-if="(data?.strengthLoads.length ?? 0) > 0" class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Charges tenues en muscu</span>
        <span class="mono text-[11.5px] text-text-muted">
          la plus lourde série de chaque séance
        </span>
      </div>

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

    <div class="tile">
      <span class="label">Journal des séances clés</span>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in KEY_SESSION_COLUMNS"
              :key="head.label"
              class="label pb-2 text-[10px]"
            >
              {{ head.label }}
              <UiInfoHint v-if="head.term" :term="head.term" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in data?.keySessions ?? []"
            :key="item.id"
            class="border-t border-line-soft"
          >
            <td class="mono py-[6px]">{{ formatDate(item.date) }}</td>
            <td class="py-[6px]">{{ SESSION_LABELS[item.code] ?? item.code }}</td>
            <td class="mono py-[6px] text-text-dim">{{ formatDistance(item.distanceM) }}</td>
            <td class="mono py-[6px] text-text-muted">{{ item.expectedRpe ?? '—' }}</td>
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
          <tr v-if="(data?.keySessions.length ?? 0) === 0">
            <td colspan="6" class="py-3 text-text-muted">
              Aucune séance clé encore planifiée ou réalisée.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
