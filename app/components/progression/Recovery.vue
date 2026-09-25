<script setup lang="ts">
import type { RpeCalibrationRow } from '~~/server/domain/learning/calibration'
import type { Recovery } from '~~/server/domain/load/recovery'

const { recovery, rpeCalibration } = defineProps<{
  recovery: Recovery
  rpeCalibration: RpeCalibrationRow[]
}>()
</script>

<template>
  <div class="tile">
    <!--
      Deux lectures d'un même sujet — comment le corps encaisse : le sommeil et
      les jours sans rien d'un côté, l'écart entre l'effort prévu et l'effort
      vécu de l'autre. Un seul en-tête (§ 9, P6.5).
    -->
    <span class="label"><UiInfoHint term="recuperation">Ressenti et récupération</UiInfoHint></span>

    <div class="grid grid-cols-1 gap-4 lean:grid-cols-[1fr_1.2fr] lean:gap-6">
      <div class="fold-3 grid gap-3 self-start">
        <div class="flex flex-col">
          <span class="label text-caption">Sommeil moyen</span>
          <span class="mono text-title">
            {{ recovery.sleepMeanH === null ? '—' : `${formatDecimal(recovery.sleepMeanH, 1)} h` }}
          </span>
          <span class="mono text-caption text-text-dim"> {{ recovery.samples.nights }} nuits </span>
        </div>
        <div class="flex flex-col">
          <span class="label text-caption">Nuits courtes</span>
          <span
            class="mono text-title"
            :class="(recovery.shortNightShare ?? 0) > 0.25 && 'text-warn'"
          >
            {{
              recovery.shortNightShare === null
                ? '—'
                : `${Math.round((recovery.shortNightShare ?? 0) * 100)} %`
            }}
          </span>
          <span class="mono text-caption text-text-dim"> {{ recovery.shortNights }} sous 6 h </span>
        </div>
        <div class="flex flex-col">
          <span class="label text-caption">Jours sans rien</span>
          <span class="mono text-title">
            {{ formatDecimal(recovery.restDaysPerWeek, 1) }}
          </span>
          <span class="mono text-caption text-text-dim">par semaine</span>
        </div>
      </div>

      <div class="flex flex-col border-l border-line-soft pl-6">
        <span class="label text-caption">
          <UiInfoHint term="calibration">Écart de RPE par séance</UiInfoHint>
        </span>

        <p v-if="(rpeCalibration.length ?? 0) === 0" class="text-body text-text-dim">
          Aucun ressenti sur la période.
        </p>

        <div
          v-for="row in rpeCalibration ?? []"
          :key="row.code"
          class="flex items-baseline gap-3 border-t border-line-soft py-[5px] first:border-t-0"
        >
          <span class="text-body">{{ SESSION_LABELS[row.code] ?? row.code }}</span>
          <span class="mono ml-auto text-body" :class="Math.abs(row.bias) >= 0.5 && 'text-warn'">
            {{ row.bias > 0 ? '+' : '' }}{{ formatDecimal(row.bias) }}
          </span>
          <span class="mono w-[84px] text-right text-meta whitespace-nowrap text-text-dim">
            {{ row.samples }} séance{{ row.samples > 1 ? 's' : '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
