<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const { session, plannedMinutes } = defineProps<{ session: PlanSession; plannedMinutes: number }>()
const emit = defineEmits<{ saved: [] }>()

interface RideSwapGiveback {
  sessionId: number
  date: string
  takenM: number
}

interface RideSwapResponse {
  ok: boolean
  refusal?: string
  replacement?: {
    prescription: PlanSession['prescription']
    givebacks: RideSwapGiveback[]
    cappedAfterLongRun: boolean
  }
}

/**
 * Le bloc n'est monté que pour une sortie vélo encore à faire aujourd'hui :
 * la proposition de remplacement se demande avec lui (§ 5, P6.42).
 */
const { data: swap } = useFetch<RideSwapResponse>(() => `/api/sessions/${session.id}/run-swap`)

const replacement = computed(() => (swap.value?.ok ? swap.value.replacement : undefined))

/** Ce que la semaine rend pour payer la course ajoutée : sa cible ne bouge pas. */
const givebackText = computed(() => {
  const item = replacement.value
  if (!item) return ''

  const taken = item.givebacks.reduce((total, giveback) => total + giveback.takenM, 0)
  const lenders =
    item.givebacks.length > 1
      ? `aux ${item.givebacks.length} endurances suivantes`
      : 'à l’endurance suivante'
  const base = `Les ${formatDistance(taken)} ajoutés sont repris ${lenders} de la semaine : le volume de course visé ne bouge pas.`

  return item.cappedAfterLongRun
    ? `${base} Elle est ramenée au minimum : c’est le lendemain de la sortie longue.`
    : base
})

const swapError = ref('')

async function replaceWithRun() {
  swapError.value = ''
  try {
    await $fetch(`/api/sessions/${session.id}/run-swap`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    swapError.value = apiMessage(failure, 'Remplacement impossible.')
  }
}
</script>

<template>
  <div class="tile order-4 bg-surface-inset lean:order-none">
    <!--
      Un vélo qu'on ne peut pas faire n'a d'issue que « manquée » : ici il
      devient une endurance, payée par les endurances suivantes de la
      semaine. Bouton fantôme — le retour de séance reste l'action
      principale de la fenêtre (§ 8, P6.42).
    -->
    <span class="label text-caption">Si tu ne peux pas la faire</span>

    <template v-if="replacement">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="mono text-body text-text-dim line-through">
          {{ session.prescription.label }} · {{ formatMinutes(plannedMinutes) }}
        </span>
        <span class="mono text-body text-accent">
          Endurance fondamentale ·
          {{ formatDistance(replacement.prescription.totalDistanceM) }} ·
          {{ formatMinutes(prescribedMinutes(replacement.prescription)) }}
        </span>
      </div>

      <span class="text-meta text-text-dim">{{ givebackText }}</span>

      <UiActionButton
        class="btn btn-ghost self-stretch lean:self-start"
        icon="run"
        :icon-size="15"
        :action="replaceWithRun"
      >
        Remplacer par une sortie course
      </UiActionButton>
    </template>

    <span v-else-if="swap" class="text-meta text-text-dim">{{ swap.refusal }}</span>

    <p v-if="swapError" class="text-body text-warn">{{ swapError }}</p>
  </div>
</template>
