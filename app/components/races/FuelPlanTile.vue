<script setup lang="ts">
/** Ce que la tuile lit du plan : la sérialisation JSON a effacé les tuples. */
interface FuelPlanView {
  durationS: number
  tempC: number | null
  carbsGPerHour: number[] | null
  waterMlPerHour: number[] | null
  intakes: unknown[]
}

const props = defineProps<{ raceId: number; fuelPlan: FuelPlanView | null }>()
const emit = defineEmits<{ generated: [] }>()

const generating = ref(false)
const error = ref('')

async function generate() {
  generating.value = true
  error.value = ''
  try {
    await $fetch(`/api/races/${props.raceId}/fuel-plan`, { method: 'POST' })
    emit('generated')
  } catch (cause) {
    error.value = apiMessage(cause, 'Génération impossible.')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="tile bg-surface-inset">
    <div class="flex items-baseline gap-3">
      <span class="label text-[10.5px]">Ravito et hydratation en course</span>
      <span v-if="fuelPlan" class="mono text-[11.5px] text-text-dim">
        sur une projection de {{ formatDuration(fuelPlan.durationS) }}
        <template v-if="fuelPlan.tempC !== null"> · {{ fuelPlan.tempC }} °C attendus</template>
      </span>
      <!-- Action secondaire : bouton fantôme dans la rangée qu'elle sert (§ 8). -->
      <button
        type="button"
        class="btn btn-ghost ml-auto size-9 shrink-0 p-0"
        :disabled="generating"
        :aria-label="fuelPlan ? 'Régénérer le plan ravito' : 'Générer le plan ravito'"
        @click="generate"
      >
        <UiAppIcon name="wand" :size="16" />
      </button>
    </div>

    <p v-if="error" class="text-[12.5px] text-warn">{{ error }}</p>

    <p v-else-if="!fuelPlan" class="text-[12.5px] text-text-dim">
      Généré à J−7, ou tout de suite depuis la baguette. Le détail des prises se lit dans Nutrition.
    </p>

    <template v-else>
      <div class="fold-3 grid gap-3">
        <div class="flex flex-col">
          <span class="label text-[10px]">Glucides</span>
          <span class="mono text-[15px]">{{ formatRange(fuelPlan.carbsGPerHour, 'g/h') }}</span>
        </div>
        <div class="flex flex-col">
          <span class="label text-[10px]">Eau</span>
          <span class="mono text-[15px]">{{ formatRange(fuelPlan.waterMlPerHour, 'ml/h') }}</span>
        </div>
        <div class="flex flex-col">
          <span class="label text-[10px]">Prises</span>
          <span class="mono text-[15px]">{{ fuelPlan.intakes.length }}</span>
        </div>
      </div>
      <span class="text-[12px] text-text-dim">
        Le détail par kilomètre se lit dans Nutrition, la semaine de la course.
      </span>
    </template>
  </div>
</template>
