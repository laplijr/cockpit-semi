<script setup lang="ts">
const { data } = await useFetch('/api/library/running')
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Allures de référence</span>
        <span class="mono text-[11.5px] text-text-muted">
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
            <td class="py-[6px]">{{ zone.label }}</td>
            <td class="mono py-[6px]">{{ formatPace(zone.paceSecPerKm) }}/km</td>
            <td class="mono py-[6px] text-text-muted">
              {{ formatPace(zone.range.fastSecPerKm) }} – {{ formatPace(zone.range.slowSecPerKm) }}
            </td>
          </tr>
          <tr class="border-t border-line-soft">
            <td class="py-[6px]">Allure semi</td>
            <td class="mono py-[6px]">{{ formatPace(data?.halfPaceSecPerKm) }}/km</td>
            <td class="mono py-[6px] text-text-muted">projection sur 21,1 km</td>
          </tr>
        </tbody>
      </table>

      <p v-if="data?.vdotIsFloor" class="text-[13px] text-text-muted">
        Ces allures viennent d'une estimation basse. Elles seront revues à la hausse dès le premier
        test 20′.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div v-for="type in data?.types ?? []" :key="type.code" class="tile">
        <div class="flex items-baseline gap-3">
          <span class="display text-[20px] font-semibold">{{ type.label }}</span>
          <span v-if="type.key" class="pill bg-accent/15 text-accent">séance clé</span>
          <span class="pill ml-auto">RPE {{ type.expectedRpe }}</span>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <div class="flex flex-col">
            <span class="label text-[10px]">Allure</span>
            <span class="mono text-[15px]">{{ formatPace(type.paceSecPerKm) }}/km</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Volume</span>
            <span class="mono text-[15px]">
              {{ formatDistance(type.prescription.totalDistanceM) }}
            </span>
          </div>
          <div v-if="type.quota.maxShareOfWeeklyVolume" class="flex flex-col">
            <span class="label text-[10px]">Quota</span>
            <span class="mono text-[15px]">
              {{ Math.round(type.quota.maxShareOfWeeklyVolume * 100) }} %
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
          <span class="label text-[10px]">Structure</span>
          <span
            v-for="step in type.prescription.steps"
            :key="step.label"
            class="mono text-[12px] text-text-dim"
          >
            {{ step.repeats ? `${step.repeats} × ` : '' }}{{ step.label }}
            <template v-if="step.distanceM"> · {{ formatDistance(step.distanceM) }}</template>
            <template v-if="step.paceSecPerKm"> · {{ formatPace(step.paceSecPerKm) }}/km</template>
            <template v-if="step.recoveryS"> · récup {{ step.recoveryS }}″</template>
          </span>
        </div>

        <div class="flex flex-wrap gap-1">
          <span v-for="phase in type.allowedPhases" :key="phase" class="pill text-[10.5px]">
            {{ PHASE_LABELS[phase] ?? phase }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
