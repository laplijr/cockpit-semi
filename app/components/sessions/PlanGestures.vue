<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

/**
 * Les gestes de la main sur une séance : en poser une de plus, la remplacer,
 * la retirer, la dire manquée (§ 5, P6.43). Plusieurs racines : chaque bloc
 * garde sa place dans l'ordre de la fenêtre au pouce.
 */
const { session, plannedMinutes, manualDay, reading } = defineProps<{
  session: PlanSession
  plannedMinutes: number
  manualDay: boolean
  reading: boolean
}>()
const emit = defineEmits<{ saved: [] }>()

const plan = usePlanStore()

const editable = computed(
  () => session.status !== 'faite' && session.status !== 'annulee' && session.date >= plan.today,
)

const editing = ref(false)
const adding = ref(false)
const editError = ref('')

async function cancelSession() {
  editError.value = ''
  try {
    await $fetch(`/api/sessions/${session.id}/cancel`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    editError.value = apiMessage(failure, 'Retrait impossible.')
  }
}

/** Son jour est arrivé et rien n'est renseigné : elle peut se dire manquée (§ 5, R6). */
const missable = computed(() => session.status === 'prevue' && session.date <= plan.today)

const skipError = ref('')

async function markMissed() {
  skipError.value = ''
  try {
    await $fetch(`/api/sessions/${session.id}/skip`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    skipError.value = apiMessage(failure, 'Impossible de la marquer manquée.')
  }
}

async function restoreDay() {
  editError.value = ''
  try {
    await $fetch(`/api/plan/days/${session.date}`, { method: 'DELETE' })
    emit('saved')
  } catch (failure) {
    editError.value = apiMessage(failure, 'Impossible de rendre la journée au moteur.')
  }
}
</script>

<template>
  <!-- Une journée peut recevoir une séance de plus, vide ou non (P6.43).
       Sur une séance faite, c'est de la saisie : elle passe par la porte. -->
  <div
    v-if="session.date >= plan.today && !reading"
    class="tile order-4 bg-surface-inset lean:order-none"
  >
    <span class="label text-caption">Ajouter une séance ce jour-là</span>

    <PlanSessionForm v-if="adding" :date="session.date" @saved="emit('saved')" />
    <button
      v-else
      type="button"
      class="btn btn-ghost self-stretch lean:self-start"
      @click="adding = true"
    >
      <UiAppIcon name="plus" :size="15" />
      Poser une séance de plus
    </button>
  </div>

  <!--
    Les deux gestes de la main : changer la séance pour celle qu'on veut,
    ou la retirer sans la compter comme manquée. Le moteur dit ce que ça
    coûte, il ne l'interdit pas (§ 1, P6.43).
  -->
  <div v-if="editable" class="tile order-4 bg-surface-inset lean:order-none">
    <span class="label text-caption">Changer cette séance</span>

    <PlanSessionForm
      v-if="editing"
      :date="session.date"
      :session-id="session.id"
      :initial="{ sport: session.sport, code: session.code, durationMin: plannedMinutes }"
      @saved="emit('saved')"
    />

    <div v-else class="flex flex-col gap-2 lean:flex-row">
      <button type="button" class="btn btn-ghost flex-1" @click="editing = true">Remplacer</button>
      <UiActionButton class="btn btn-ghost flex-1" :action="cancelSession">
        Retirer du plan
      </UiActionButton>
    </div>

    <UiActionButton
      v-if="manualDay"
      class="btn btn-ghost self-stretch lean:self-start"
      :action="restoreDay"
    >
      Rendre la journée au moteur
    </UiActionButton>
    <p v-if="editError" class="text-body text-warn">{{ editError }}</p>
  </div>

  <!-- Le retour de séance dit « faite » ; ceci dit l'inverse, sans ressenti.
       Contrairement au retrait, la séance compte comme manquée (§ 5, R6). -->
  <div v-if="missable" class="tile order-4 bg-surface-inset lean:order-none">
    <span class="label text-caption">Pas faite</span>
    <UiActionButton class="btn btn-ghost self-stretch lean:self-start" :action="markMissed">
      Marquer manquée
    </UiActionButton>
    <p v-if="skipError" class="text-body text-warn">{{ skipError }}</p>
  </div>
</template>
