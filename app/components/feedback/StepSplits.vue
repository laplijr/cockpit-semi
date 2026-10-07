<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'
import { splitSlots, splitsPace, type StepSplit } from '~~/server/domain/running/splits'

/**
 * Le réalisé portion par portion : un tiers de progressif, une fraction de
 * VMA. La montre en donne un tour chacun, et les totaux seuls ne disaient pas
 * si la fin avait été tenue.
 */
const { session } = defineProps<{ session: PlanSession }>()
const splits = defineModel<StepSplit[]>({ required: true })
const emit = defineEmits<{ totals: [{ durationS: number; distanceM: number }] }>()

const slots = splitSlots(session.prescription)

/**
 * Entre deux fractions, la récupération court aussi : la somme des portions
 * n'est le total de la séance que quand elle n'en a pas.
 */
const sumsToTotal = !session.prescription.steps.some((step) => step.recoveryS)

const rows = ref(
  slots.map((slot) => {
    const known = splits.value.find((item) => item.step === slot.step && item.rep === slot.rep)
    return {
      slot,
      distanceM: known?.distanceM ?? slot.distanceM ?? null,
      time: known ? formatDuration(known.durationS) : '',
    }
  }),
)

const open = ref(splits.value.length > 0)

function plannedTime(slot: (typeof slots)[number]): string {
  if (slot.durationS) return formatDuration(slot.durationS)
  if (slot.distanceM && slot.paceSecPerKm) {
    return formatDuration((slot.distanceM / 1000) * slot.paceSecPerKm)
  }
  return 'm:ss'
}

function rowLabel(slot: (typeof slots)[number]): string {
  return slot.repeats > 1 ? `${slot.label} ${slot.rep + 1}/${slot.repeats}` : slot.label
}

/** Ce qui a été tenu sur la ligne, sinon ce qui y était visé. */
function rowLine(row: (typeof rows.value)[number]): string {
  const timed = splitOf(row)
  if (timed) return `tenu ${formatPace(splitsPace([timed]))}/km`
  if (row.slot.paceSecPerKm) return `visé ${formatPace(row.slot.paceSecPerKm)}/km`
  return 'à l’effort'
}

function splitOf(row: (typeof rows.value)[number]): StepSplit | null {
  const durationS = textToDuration(row.time)
  if (!row.distanceM || !durationS) return null
  return { step: row.slot.step, rep: row.slot.rep, distanceM: row.distanceM, durationS }
}

watch(
  rows,
  (list) => {
    const timed = list.flatMap((row) => splitOf(row) ?? [])
    splits.value = timed
    if (!sumsToTotal || timed.length < slots.length) return
    emit('totals', {
      durationS: timed.reduce((sum, item) => sum + item.durationS, 0),
      distanceM: timed.reduce((sum, item) => sum + item.distanceM, 0),
    })
  },
  { deep: true },
)
</script>

<template>
  <div class="flex flex-col gap-[6px]">
    <button
      v-if="!open"
      type="button"
      class="btn btn-ghost self-stretch lean:self-start"
      @click="open = true"
    >
      Saisir le détail par étape
    </button>

    <template v-else>
      <div class="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-end gap-2">
        <span class="label text-caption">Détail par étape</span>
        <span class="label text-caption">Mètres</span>
        <span class="label text-caption">Temps</span>
      </div>
      <div
        v-for="row in rows"
        :key="`${row.slot.step}-${row.slot.rep}`"
        class="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2"
      >
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-body">{{ rowLabel(row.slot) }}</span>
          <span class="mono text-meta text-text-dim">{{ rowLine(row) }}</span>
        </span>
        <input
          v-model.number="row.distanceM"
          type="number"
          inputmode="numeric"
          class="input mono w-full"
          :aria-label="`Distance, ${rowLabel(row.slot)}`"
        />
        <input
          v-model="row.time"
          type="text"
          inputmode="numeric"
          class="input mono w-full"
          :placeholder="plannedTime(row.slot)"
          :aria-label="`Temps, ${rowLabel(row.slot)}`"
        />
      </div>
      <span class="text-meta text-text-dim">
        Le temps en minutes et secondes, « 9:41 ».
        <template v-if="sumsToTotal"> Les étapes remplies, le total suit.</template>
      </span>
    </template>
  </div>
</template>
