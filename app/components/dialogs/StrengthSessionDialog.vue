<script setup lang="ts">
/**
 * Détail d'une séance de la bibliothèque Renforcement (§ 8, P6.35). La page est
 * un index : les chiffres de chaque exercice — séries, reps, récup, tempo —
 * n'apparaissent ici qu'au clic sur l'exercice, qui ouvre sa propre fenêtre.
 */
const props = defineProps<{ code: string }>()

const ui = useUiStore()

const { data } = await useFetch('/api/library/strength')

const session = computed(() =>
  (data.value?.sessions ?? []).find((item) => item.code === props.code),
)

const planned = computed(() => (data.value?.plannedCodes ?? []).some((code) => code === props.code))
</script>

<template>
  <div v-if="session" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">{{ session.label }}</span>
      <span class="mono text-[11.5px] text-text-dim">
        {{ formatMinutes(session.prescription.durationMin) }} · RPE
        {{ session.prescription.expectedRpe }} · {{ session.prescription.steps.length }} ex.
      </span>
      <span v-if="planned" class="pill ml-auto bg-accent/15 text-accent">cette semaine</span>
    </div>

    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Ce qu'elle cherche</span>
      <p class="text-[13px] text-text-dim">{{ session.note }}</p>
    </div>

    <!-- Les noms seuls : séries, reps et récup se lisent dans l'exercice. -->
    <div class="flex flex-col">
      <button
        v-for="step in session.prescription.steps"
        :key="step.label"
        type="button"
        class="tap tile-action -mx-1 flex items-baseline gap-2 rounded-sm border border-transparent border-t-line-soft px-1 py-[7px] text-left"
        :disabled="!step.exerciseId"
        @click="step.exerciseId && ui.openExercise(step.exerciseId)"
      >
        <span class="text-[13.5px]">{{ step.label }}</span>
        <span v-if="step.superset" class="pill text-[10px]">
          <UiInfoHint term="superset">superset</UiInfoHint>
        </span>
        <UiAppIcon
          v-if="step.exerciseId"
          name="chevron"
          :size="13"
          class="ml-auto shrink-0 self-center text-icon"
        />
      </button>
    </div>
  </div>
</template>
