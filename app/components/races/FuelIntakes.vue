<script setup lang="ts">
import type { FuelIntake } from '~~/server/domain/nutrition/fuel-plan'

/** Au-delà de six prises, les étiquettes se chevauchent : la table reprend la main. */
const FRIEZE_MAX_INTAKES = 6

const props = defineProps<{ intakes: FuelIntake[] }>()

const friezeFits = computed(
  () => props.intakes.length > 0 && props.intakes.length <= FRIEZE_MAX_INTAKES,
)

/**
 * Un repère par minute de course : l'eau et le gel pris ensemble tiennent au
 * même point de la frise, et non l'un sur l'autre.
 */
const moments = computed(() => {
  const byMinute = new Map<number, FuelIntake[]>()
  for (const intake of props.intakes) {
    byMinute.set(intake.minute, [...(byMinute.get(intake.minute) ?? []), intake])
  }

  return [...byMinute.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minute, taken]) => ({
      minute,
      km: taken[0]!.km,
      optional: taken.every((intake) => intake.optional),
      taken,
    }))
})
</script>

<template>
  <!-- Six prises ou moins tiennent sur une frise : la course se lit dans l'ordre
       où elle se court, un repère par minute de prise (§ 8, P6.35). -->
  <div v-if="friezeFits" class="flex items-stretch">
    <div
      v-for="moment in moments"
      :key="moment.minute"
      class="relative flex flex-1 flex-col items-center gap-[4px] pt-1"
    >
      <span class="flex flex-col items-center gap-px px-2 text-center">
        <span v-for="intake in moment.taken" :key="intake.product" class="flex flex-col">
          <span class="text-[12.5px] leading-[1.2]">
            {{ FUEL_PRODUCT_LABELS[intake.product] ?? intake.product }}
          </span>
          <span class="mono text-[10.5px] text-text-dim">{{ intake.quantity }}</span>
        </span>
      </span>

      <!-- L'axe passe derrière les repères, d'un bord à l'autre de la frise. -->
      <span class="relative mt-auto flex w-full justify-center">
        <span class="absolute inset-x-0 top-[3px] h-px bg-line" />
        <span
          class="relative size-[7px] rounded-full"
          :class="moment.optional ? 'bg-accent-track' : 'bg-accent'"
        />
      </span>

      <span class="mono text-[10.5px] text-text-dim">
        {{ moment.minute }}′ · km {{ moment.km }}
        <template v-if="moment.optional"> · option</template>
      </span>
    </div>
  </div>

  <table v-else-if="intakes.length > 0" class="w-full text-[13px]">
    <thead>
      <tr class="text-left">
        <th v-for="head in ['Minute', 'Km', 'Prise']" :key="head" class="label pb-2 text-[10px]">
          {{ head }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(intake, index) in intakes"
        :key="`${intake.minute}-${intake.product}-${index}`"
        class="border-t border-line-soft"
      >
        <td class="mono py-[6px]">{{ intake.minute }}′</td>
        <td class="mono py-[6px] text-text-dim">{{ intake.km }}</td>
        <td class="py-[6px]">
          {{ FUEL_PRODUCT_LABELS[intake.product] ?? intake.product }} · {{ intake.quantity }}
          <span v-if="intake.optional" class="pill ml-2 text-[10px]">optionnelle</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
