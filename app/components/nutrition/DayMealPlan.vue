<script setup lang="ts">
import { MealEmphasis, formatHour } from '~~/server/domain/nutrition/meal-timing'

const props = defineProps<{ date: string }>()

const { data, refresh } = await useFetch('/api/nutrition/meal-plan', {
  query: { date: computed(() => props.date) },
})

const asking = ref(false)
const error = ref('')
const llm = useLlmAvailable()

/** Le rôle du créneau se dit en trois mots ; le reste est dans le glossaire. */
const EMPHASIS_LABELS: Record<string, string> = {
  [MealEmphasis.PreSession]: 'avant la séance',
  [MealEmphasis.Recovery]: 'recharge',
}

async function ask() {
  asking.value = true
  error.value = ''
  try {
    await $fetch('/api/nutrition/meal-plan', { method: 'POST', body: { date: props.date } })
    await refresh()
  } catch (cause) {
    error.value = apiMessage(cause, 'Génération impossible.')
  } finally {
    asking.value = false
  }
}
</script>

<template>
  <div class="tile bg-surface-inset">
    <div class="flex items-center gap-3">
      <span class="label text-[10.5px]"
        ><UiInfoHint term="repasDuJour">Repas du jour</UiInfoHint></span
      >
      <!-- Ouvrir le jour ne génère rien : seul ce geste appelle le modèle (§ 1). -->
      <button
        v-if="data?.meals && llm"
        type="button"
        class="btn btn-ghost ml-auto size-9 shrink-0 p-0"
        :disabled="asking"
        aria-label="Régénérer les repas du jour"
        @click="ask"
      >
        <UiAppIcon name="wand" :size="16" />
      </button>
    </div>

    <p v-if="error" class="text-[12.5px] text-warn">{{ error }}</p>

    <!-- Sans clé, il n'y a rien à demander : les repas déjà générés restent lisibles. -->
    <p v-else-if="!llm && !data?.meals" class="text-[12.5px] text-text-dim">
      Plan de nutrition indisponible : la clé du modèle est absente.
    </p>

    <button
      v-else-if="!data?.meals"
      type="button"
      class="btn self-start"
      :disabled="asking"
      @click="ask"
    >
      {{ asking ? 'Génération…' : 'Demander le plan de nutrition' }}
    </button>

    <div
      v-for="meal in data?.meals ?? []"
      :key="`${meal.kind}-${meal.hour}`"
      class="grid grid-cols-[64px_1fr] items-baseline gap-3 border-t border-line-soft py-2 first:border-t-0"
    >
      <span class="mono text-[12px] text-text-dim">{{ formatHour(meal.hour) }}</span>
      <div class="flex flex-col gap-px">
        <span class="flex items-baseline gap-2">
          <span class="text-[13px]">{{ meal.name }}</span>
          <span v-if="EMPHASIS_LABELS[meal.emphasis]" class="mono text-[11px] text-text-dim">
            {{ EMPHASIS_LABELS[meal.emphasis] }}
          </span>
        </span>
        <span class="text-[12.5px] text-text-dim">{{ meal.description }}</span>
      </div>
    </div>
  </div>
</template>
