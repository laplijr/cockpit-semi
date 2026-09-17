<script setup lang="ts">
/**
 * Rappel nutrition sous la ligne « demain » (§ 9, P6). Il ne s'affiche que la
 * semaine d'une course, là où la veille compte : le reste du temps, les repères
 * se lisent dans Nutrition et n'ont rien à faire sur l'écran principal.
 */
const { data, status } = useFetch('/api/nutrition', { lazy: true, server: false })

const raceWeek = computed(() => data.value?.raceWeek ?? null)

const tomorrow = computed(() => {
  const days = data.value?.days ?? []
  return days[1] ?? null
})

/** Le jour du protocole qui correspond à demain, quand il en fait partie. */
const protocolDay = computed(() =>
  raceWeek.value?.protocol.find((day) => day.date === tomorrow.value?.date),
)
</script>

<template>
  <p v-if="!isLoading(status) && protocolDay" class="mono text-[11.5px] text-text-dim">
    <UiAppIcon name="nutri" :size="13" class="mr-1 inline text-accent" />
    {{ raceWeek!.race.name }} à J−{{ protocolDay.daysBefore }} · {{ protocolDay.headline }} ·
    {{
      protocolDay.carbsG
        ? formatRange(protocolDay.carbsG, 'g')
        : formatRange(protocolDay.carbsGPerKg, 'g/kg')
    }}
    de glucides
  </p>
</template>
