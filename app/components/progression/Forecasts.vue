<script setup lang="ts">
import type { Accuracy, HorizonAccuracy } from '~~/server/domain/fitness/accuracy'
import type { GlossaryTerm } from '~/utils/glossary'

interface ForecastRow {
  id: number
  label: string
  issuedDate: string
  targetDate: string
  projectedVdot: number | null
  lowVdot: number | null
  highVdot: number | null
  actualVdot: number | null
  gapVdot: number | null
}

const { rows, overall, accuracy } = defineProps<{
  rows: ForecastRow[]
  overall: Accuracy | null
  accuracy: HorizonAccuracy[]
}>()

/** Les trois horizons, dans l'ordre du plus court au plus long (§ 9, P6.6). */
const HORIZON_LABELS: Record<string, string> = {
  court: 'Moins de 4 semaines',
  moyen: '4 à 12 semaines',
  long: 'Au-delà de 12 semaines',
}

const FORECAST_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Émise le' },
  { label: 'Cible' },
  { label: 'Projeté', term: 'projection' },
  { label: 'Réalisé' },
  { label: 'Écart', term: 'biais' },
]

/**
 * Une liste qui s'allonge. Elle défilait dans sa tuile ; elle se feuillette
 * maintenant, comme partout ailleurs (§ 8) : une tuile garde sa hauteur, et
 * le pied dit sur combien on lit.
 */
const FORECAST_PER_PAGE = 6
const forecasts = usePagedList(() => rows, FORECAST_PER_PAGE)

/** Un VDOT garde sa décimale, même nulle : la colonne s'aligne. */
const vdotText = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toFixed(1).replace('.', ',')

const signedVdot = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${vdotText(value)}`
</script>

<template>
  <div class="tile">
    <!--
      La boucle de crédibilité : ce que le cockpit annonçait, et ce qui est
      arrivé. Trois comparaisons valent tous les cadrans du monde, zéro n'en
      vaut aucun (§ 9, P6.6).
    -->
    <div class="flex items-baseline gap-3">
      <span class="label">Ce que le cockpit avait prévu</span>

      <span v-if="overall" class="mono ml-auto text-meta text-text-dim">
        <UiInfoHint term="biais"> biais {{ signedVdot(overall.biasVdot) }} VDOT </UiInfoHint>
        · {{ overall.count }} comparaisons ·
        <UiInfoHint term="intervalle"> {{ overall.coveragePct }} % dans l'intervalle </UiInfoHint>
      </span>
    </div>

    <p v-if="forecasts.total === 0" class="text-body text-text-dim">
      Aucune échéance passée : la première comparaison tombera au prochain test.
    </p>

    <template v-else>
      <div class="fold-3 grid gap-3">
        <div v-for="verdict in accuracy" :key="verdict.horizon" class="flex flex-col">
          <span class="label text-caption">
            <UiInfoHint term="horizon">{{ HORIZON_LABELS[verdict.horizon] }}</UiInfoHint>
          </span>

          <span
            class="mono text-title"
            :class="
              verdict.accuracy === undefined
                ? 'text-text-dim'
                : Math.abs(verdict.accuracy.biasVdot) >= 0.5 && 'text-warn'
            "
          >
            <template v-if="verdict.accuracy === undefined">—</template>
            <template v-else>{{ signedVdot(verdict.accuracy.biasVdot) }} VDOT</template>
          </span>

          <span class="mono text-caption text-text-dim">
            <template v-if="verdict.accuracy === undefined"> moins de trois comparaisons </template>
            <template v-else>
              {{ verdict.accuracy.count }} comparaison{{ verdict.accuracy.count > 1 ? 's' : '' }}
              ·
              <UiInfoHint term="intervalle">
                {{ verdict.accuracy.coveragePct }} % dans l'intervalle
              </UiInfoHint>
            </template>
          </span>
        </div>
      </div>

      <UiAxisScroller>
        <table class="table-axis w-full text-body">
          <thead>
            <tr class="text-left">
              <th
                v-for="head in FORECAST_COLUMNS"
                :key="head.label"
                class="label pb-2 text-caption"
              >
                <UiInfoHint v-if="head.term" :term="head.term">{{ head.label }}</UiInfoHint>
                <template v-else>{{ head.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in forecasts.items" :key="row.id" class="border-t border-line-soft">
              <td class="mono py-[6px] text-text-dim">{{ formatDate(row.issuedDate) }}</td>
              <td class="py-[6px]">
                {{ row.label }}
                <span class="mono ml-1 text-caption text-text-dim">
                  {{ formatDate(row.targetDate) }}
                </span>
              </td>
              <td class="mono py-[6px]">
                {{ vdotText(row.projectedVdot) }}
                <span class="text-caption text-text-dim">
                  {{ vdotText(row.lowVdot) }}–{{ vdotText(row.highVdot) }}
                </span>
              </td>
              <td class="mono py-[6px]">{{ vdotText(row.actualVdot) }}</td>
              <td
                class="mono py-[6px]"
                :class="Math.abs(row.gapVdot ?? 0) > 0.5 ? 'text-warn' : 'text-text-dim'"
              >
                {{ signedVdot(row.gapVdot) }}
              </td>
            </tr>
          </tbody>
        </table>
      </UiAxisScroller>

      <UiPager v-model="forecasts.page" :total="forecasts.total" :per-page="FORECAST_PER_PAGE" />
    </template>
  </div>
</template>
