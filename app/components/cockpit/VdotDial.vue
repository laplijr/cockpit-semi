<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean }>()

const plan = usePlanStore()
const { data } = await useFetch('/api/library/running')

const shown = computed(() =>
  (data.value?.zones ?? []).filter((zone) => ['easy', 'threshold', 'interval'].includes(zone.key)),
)

const label = computed(() => (props.isFloor ? 'Plancher' : 'VDOT'))
</script>

<template>
  <div class="tile">
    <div class="flex items-baseline justify-between">
      <span class="label">{{ label }}</span>
      <span v-if="isFloor" class="pill pill-warn">estimation basse</span>
    </div>

    <span class="display text-[44px] leading-none font-bold">
      {{ vdot === null ? '—' : vdot.toFixed(1).replace('.', ',') }}
    </span>

    <div class="grid grid-cols-3 gap-[10px]">
      <div v-for="zone in shown" :key="zone.key" class="flex flex-col">
        <span class="label text-[10.5px]">{{ zone.label }}</span>
        <span class="mono text-[15px]">{{ formatPace(zone.paceSecPerKm) }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
      <span class="label text-[10px]">Prochain test</span>
      <span class="mono text-[13px]">
        <template v-if="plan.nextTestWeek">
          semaine {{ plan.nextTestWeek.index }}
          <template v-if="!plan.awaitingResumption">
            · {{ formatDate(plan.nextTestWeek.startDate) }}
          </template>
        </template>
        <template v-else>à la reprise</template>
      </span>
    </div>

    <p v-if="isFloor" class="text-[12px] text-text-muted">
      Déduit du meilleur segment continu de ta dernière course, dont le chrono n'était pas
      représentatif. Le test 20′ le remplacera par une vraie mesure.
    </p>
  </div>
</template>
