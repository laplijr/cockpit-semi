<script setup lang="ts">
import { SESSION_TERMS, ZONE_TERMS, glossaryTermFor } from '~/utils/glossary'

const { data } = await useFetch('/api/library/running')
const ui = useUiStore()

/** La structure tient sur une ligne : ce que contient la séance, pas son détail. */
function structureOf(steps: { label: string; repeats?: number }[]): string {
  return steps.map((step) => `${step.repeats ? `${step.repeats} × ` : ''}${step.label}`).join(' · ')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Allures de référence</span>
        <span class="mono text-[11.5px] text-text-dim">
          {{ data?.vdotIsFloor ? 'Plancher' : 'VDOT' }}
          {{ data?.vdot?.toFixed(1).replace('.', ',') }} ·
          {{ formatDistance(data?.weeklyVolumeM ?? 0) }} cette semaine
        </span>
      </div>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in ['Zone', 'Allure', 'Plage']"
              :key="head"
              class="label pb-2 text-[10px]"
            >
              {{ head }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="zone in data?.zones ?? []" :key="zone.key" class="border-t border-line-soft">
            <td class="py-[6px]">
              {{ zone.label }}
              <UiInfoHint :term="glossaryTermFor(ZONE_TERMS, zone.key)!" />
            </td>
            <td class="mono py-[6px]">{{ formatPace(zone.paceSecPerKm) }}/km</td>
            <td class="mono py-[6px] text-text-dim">
              {{ formatPace(zone.range.fastSecPerKm) }} – {{ formatPace(zone.range.slowSecPerKm) }}
            </td>
          </tr>
          <tr class="border-t border-line-soft">
            <td class="py-[6px]">Allure semi <UiInfoHint term="allureSemi" /></td>
            <td class="mono py-[6px]">{{ formatPace(data?.halfPaceSecPerKm) }}/km</td>
            <td class="mono py-[6px] text-text-dim">projection sur 21,1 km</td>
          </tr>
        </tbody>
      </table>

      <p v-if="data?.vdotIsFloor" class="text-[13px] text-text-dim">
        Estimation basse, revue au premier test 20′.
      </p>
    </div>

    <!-- Une fiche : nom, valeur dominante, structure sur une ligne, réglette
         de phases. Le reste — RPE, quota, note — passe au survol (§ 8, P6.35). -->
    <div class="grid grid-cols-3 gap-4">
      <button
        v-for="type in data?.types ?? []"
        :key="type.code"
        type="button"
        class="tile tile-action text-left"
        @click="ui.openLibrarySession('course', type.code)"
      >
        <span class="flex items-baseline gap-2">
          <span class="display truncate text-[17px] font-semibold">
            {{ type.label }}
            <UiInfoHint
              v-if="glossaryTermFor(SESSION_TERMS, type.code)"
              :term="glossaryTermFor(SESSION_TERMS, type.code)!"
            />
          </span>
          <span
            v-if="type.key"
            class="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-accent"
            title="Séance clé"
          />
        </span>

        <span class="mono text-[24px] leading-none">{{ formatPace(type.paceSecPerKm) }}/km</span>

        <span
          class="mono truncate text-[12px] text-text-dim"
          :title="structureOf(type.prescription.steps)"
        >
          {{ formatDistance(type.prescription.totalDistanceM) }} ·
          {{ structureOf(type.prescription.steps) }}
        </span>

        <span class="mt-auto block pt-1">
          <UiPhaseRail :allowed="type.allowedPhases" />
        </span>
      </button>
    </div>
  </div>
</template>
