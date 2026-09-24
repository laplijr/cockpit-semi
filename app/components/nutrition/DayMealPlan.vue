<script setup lang="ts">
import { MealEmphasis, formatHour } from '~~/server/domain/nutrition/meal-timing'

const props = defineProps<{ date: string }>()

const { data, refresh } = await useFetch('/api/nutrition/meal-plan', {
  query: { date: computed(() => props.date) },
})

/**
 * Exception à la règle du § 8 : le libellé se réécrit. L'attente dure des
 * secondes et le mot nomme ce qui se passe ; ailleurs, le dessin suffit.
 */
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
  <!-- Sans clé et sans repas déjà générés, la tuile n'a rien à montrer (§ 6). -->
  <div v-if="llm || data?.meals" class="tile bg-surface-inset">
    <div class="flex items-center gap-3">
      <span class="label text-caption"
        ><UiInfoHint term="repasDuJour">Repas du jour</UiInfoHint></span
      >
      <!-- Ouvrir le jour ne génère rien : seul ce geste appelle le modèle (§ 1). -->
      <UiActionButton
        v-if="data?.meals && llm"
        class="btn btn-ghost ml-auto size-9 shrink-0 p-0"
        icon="wand"
        aria-label="Régénérer les repas du jour"
        :action="ask"
      />
    </div>

    <p v-if="error" class="text-meta text-warn">{{ error }}</p>

    <UiActionButton v-else-if="!data?.meals && llm" class="btn self-start" :action="ask">
      {{ asking ? 'Génération…' : 'Demander le plan de nutrition' }}
    </UiActionButton>

    <div
      v-for="meal in data?.meals ?? []"
      :key="`${meal.kind}-${meal.hour}`"
      class="grid grid-cols-[64px_1fr] items-baseline gap-3 border-t border-line-soft py-2 first:border-t-0"
    >
      <span class="mono text-meta text-text-dim">{{ formatHour(meal.hour) }}</span>
      <div class="flex flex-col gap-px">
        <span class="flex items-baseline gap-2">
          <span class="text-body">{{ meal.name }}</span>
          <span v-if="EMPHASIS_LABELS[meal.emphasis]" class="mono text-caption text-text-dim">
            {{ EMPHASIS_LABELS[meal.emphasis] }}
          </span>
        </span>
        <span class="text-meta text-text-dim">{{ meal.description }}</span>
      </div>
    </div>
  </div>
</template>
