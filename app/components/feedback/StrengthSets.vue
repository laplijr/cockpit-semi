<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const props = defineProps<{ session: PlanSession; rpe: number }>()

interface ExerciseState {
  exerciseId: string
  targetReps: number
  lastLoadKg: number | null
  suggestedLoadKg: number | null
  reserve: number | null
  recordedSets: { index: number; reps: number; loadKg: number }[]
}

const { data } = useFetch<{ exercises: ExerciseState[] }>(
  `/api/sessions/${props.session.id}/strength`,
)

const labels = new Map(
  props.session.prescription.steps
    .filter((step) => step.exerciseId)
    .map((step) => [step.exerciseId!, step.label]),
)

const exercises = computed(() =>
  (data.value?.exercises ?? []).map((exercise) => ({
    ...exercise,
    label: labels.get(exercise.exerciseId) ?? exercise.exerciseId,
    sets:
      props.session.prescription.steps.find((step) => step.exerciseId === exercise.exerciseId)
        ?.repeats ?? 1,
  })),
)

interface SetRow {
  exerciseId: string
  index: number
  reps: number
  loadKg: number
}

/**
 * Une séance faite en salle a déjà ses séries, cochées une à une (P27) : le
 * retour de séance les montre en lecture, il ne les réécrit pas.
 */
const fromGym = computed(
  () =>
    props.session.status !== 'faite' &&
    exercises.value.some((exercise) => exercise.recordedSets.length > 0),
)

/** Séries pré-remplies par le format prescrit et la charge proposée. */
const rows = ref<SetRow[]>([])

watch(
  exercises,
  (list) => {
    rows.value = list.flatMap((exercise) =>
      fromGym.value
        ? exercise.recordedSets.map((set) => ({ exerciseId: exercise.exerciseId, ...set }))
        : Array.from({ length: exercise.sets }, (_, index) => ({
            exerciseId: exercise.exerciseId,
            index: index + 1,
            reps: exercise.targetReps,
            loadKg: exercise.suggestedLoadKg ?? 0,
          })),
    )
  },
  { immediate: true },
)

function setsOf(exerciseId: string) {
  return rows.value.filter((row) => row.exerciseId === exerciseId)
}

async function save() {
  if (rows.value.length === 0 || fromGym.value) return
  await $fetch(`/api/sessions/${props.session.id}/strength`, {
    method: 'PUT',
    body: { sets: rows.value.map((row) => ({ ...row, rpe: props.rpe })) },
  })
}

defineExpose({ save })
</script>

<template>
  <div class="flex flex-col gap-3">
    <span class="label text-caption">Séries réalisées</span>
    <p v-if="fromGym" class="text-meta text-text-dim">Enregistrées en salle, série par série.</p>

    <div v-for="exercise in exercises" :key="exercise.exerciseId" class="flex flex-col gap-2">
      <span class="flex items-baseline gap-2">
        <span class="text-body">{{ exercise.label }}</span>
        <span class="mono text-meta text-text-dim">
          {{ exercise.sets }} × {{ exercise.targetReps }}
        </span>
        <!-- Des kilos, et la réserve en second (P26). -->
        <span v-if="exercise.suggestedLoadKg !== null" class="mono ml-auto text-meta">
          <template v-if="exercise.lastLoadKg !== null">
            <span class="text-text-dim line-through">{{ formatLoad(exercise.lastLoadKg) }}</span>
            <span class="mx-1 text-text-dim">→</span>
          </template>
          <span class="text-accent">{{ formatLoad(exercise.suggestedLoadKg) }}</span>
          <span v-if="exercise.reserve !== null" class="text-text-dim">
            · {{ exercise.reserve }} en réserve
          </span>
        </span>
      </span>

      <div
        v-for="row in setsOf(exercise.exerciseId)"
        :key="row.index"
        class="grid grid-cols-[20px_1fr_1fr] items-center gap-2"
      >
        <span class="mono text-meta text-text-dim">{{ row.index }}</span>
        <label class="flex items-center gap-2">
          <span class="label text-caption">Rép.</span>
          <input
            v-model.number="row.reps"
            type="number"
            inputmode="numeric"
            min="0"
            class="input mono"
            :disabled="fromGym"
          />
        </label>
        <label class="flex items-center gap-2">
          <span class="label text-caption">Kg</span>
          <input
            v-model.number="row.loadKg"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            class="input mono"
            :disabled="fromGym"
          />
        </label>
      </div>
    </div>
  </div>
</template>
