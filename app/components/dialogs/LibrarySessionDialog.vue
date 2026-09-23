<script setup lang="ts">
import { SESSION_TERMS, glossaryTermFor } from '~/utils/glossary'

/**
 * Détail d'une séance des bibliothèques Course à pied et Vélo (§ 8, P6.35).
 * La fiche ne montre que le nom, la valeur dominante, la structure sur une
 * ligne et la réglette : le reste — RPE, quota, étapes détaillées — est ici.
 */
const props = defineProps<{ sport: 'course' | 'velo'; code: string }>()

const { data: running } = await useFetch('/api/library/running')
const { data: cycling } = await useFetch('/api/library/cycling')

const runType = computed(() =>
  props.sport === 'course'
    ? (running.value?.types ?? []).find((type) => type.code === props.code)
    : undefined,
)

const rideType = computed(() =>
  props.sport === 'velo'
    ? (cycling.value?.types ?? []).find((type) => type.code === props.code)
    : undefined,
)

const label = computed(() => runType.value?.label ?? rideType.value?.label ?? props.code)

const steps = computed(
  () => runType.value?.prescription.steps ?? rideType.value?.prescription.steps ?? [],
)

const expectedRpe = computed(() => runType.value?.expectedRpe ?? rideType.value?.expectedRpe ?? 0)

const term = computed(() => glossaryTermFor(SESSION_TERMS, props.code))

/** La sortie longue porte un plancher, les séances de qualité un plafond (§ 5). */
function quotaLabel(quota: { maxShareOfWeeklyVolume?: number; minShareOfWeeklyVolume?: number }) {
  if (quota.maxShareOfWeeklyVolume) return `${Math.round(quota.maxShareOfWeeklyVolume * 100)} %`
  if (quota.minShareOfWeeklyVolume)
    return `au moins ${Math.round(quota.minShareOfWeeklyVolume * 100)} %`
  return '—'
}

/** Les chiffres qui tiennent la séance, selon le sport. */
const figures = computed(() => {
  if (runType.value) {
    return [
      { key: 'allure', label: 'Allure', value: `${formatPace(runType.value.paceSecPerKm)}/km` },
      {
        key: 'plage',
        label: 'Plage',
        value: `${formatPace(runType.value.paceRange.fastSecPerKm)} – ${formatPace(runType.value.paceRange.slowSecPerKm)}`,
      },
      {
        key: 'volume',
        label: 'Volume',
        value: formatDistance(runType.value.prescription.totalDistanceM),
      },
      {
        key: 'quota',
        label: 'Quota',
        value: quotaLabel(runType.value.quota),
      },
    ]
  }
  if (!rideType.value) return []
  return [
    { key: 'puissance', label: 'Puissance', value: rideType.value.ftpRange },
    { key: 'fc', label: 'Fréquence cardiaque', value: rideType.value.hrRange },
    {
      key: 'duree',
      label: 'Durée',
      value: `${formatMinutes(rideType.value.minDurationMin)} – ${formatMinutes(rideType.value.maxDurationMin)}`,
    },
  ]
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">
        <UiInfoHint v-if="term" :term="term">{{ label }}</UiInfoHint>
        <template v-else>{{ label }}</template>
      </span>
      <span class="mono text-[11.5px] text-text-dim">RPE {{ expectedRpe }}</span>
      <span v-if="runType?.key" class="pill ml-auto bg-accent/15 text-accent">
        <UiInfoHint term="seanceCle">séance clé</UiInfoHint>
      </span>
      <span v-else-if="rideType?.onPainOnly" class="pill pill-warn ml-auto">sur douleur</span>
    </div>

    <div class="fold-4 grid gap-4">
      <div v-for="figure in figures" :key="figure.key" class="tile bg-surface-inset">
        <span class="label text-[10.5px]">{{ figure.label }}</span>
        <span class="mono text-[17px]">{{ figure.value }}</span>
      </div>
    </div>

    <div v-if="rideType?.note" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Ce qu'elle cherche</span>
      <p class="text-[13px] text-text-dim">{{ rideType.note }}</p>
    </div>

    <div class="flex flex-col">
      <span class="label text-[10.5px]">Structure</span>
      <span
        v-for="step in steps"
        :key="step.label"
        class="mono border-t border-line-soft py-[7px] text-[12.5px]"
      >
        {{ step.repeats ? `${step.repeats} × ` : '' }}{{ step.label }}
        <template v-if="step.distanceM"> · {{ formatDistance(step.distanceM) }}</template>
        <template v-if="step.durationS"> · {{ formatSeconds(step.durationS) }}</template>
        <template v-if="step.paceSecPerKm"> · {{ formatPace(step.paceSecPerKm) }}/km</template>
        <template v-if="step.recoveryS"> · récup {{ formatSeconds(step.recoveryS) }}</template>
      </span>
    </div>

    <UiPhaseRail :allowed="runType?.allowedPhases ?? rideType?.allowedPhases ?? []" />
  </div>
</template>
