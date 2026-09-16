<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean }>()

const { data } = await useFetch('/api/library/running')

const zones = computed(() => {
  const types = data.value?.types ?? []
  return (['EF', 'seuil', 'VMA'] as const)
    .map((code) => types.find((type) => type.code === code))
    .filter((type) => type !== undefined)
})

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
      <div v-for="zone in zones" :key="zone.code" class="flex flex-col">
        <span class="label text-[10.5px]">{{ SESSION_LABELS[zone.code] ?? zone.code }}</span>
        <span class="mono text-[15px]">{{ formatPace(zone.paceSecPerKm) }}</span>
      </div>
    </div>

    <p v-if="isFloor" class="text-[12px] text-text-muted">
      Déduit du meilleur segment continu de ta dernière course, dont le chrono n'était pas
      représentatif. Un test 20′ le remplacera par une vraie mesure.
    </p>
  </div>
</template>
