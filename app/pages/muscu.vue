<script setup lang="ts">
const { data } = await useFetch('/api/library/strength')
const ui = useUiStore()

const planned = computed(() => new Set(data.value?.plannedCodes ?? []))

const preventionBlock = computed(() =>
  (data.value?.exercises ?? []).filter((exercise) => exercise.group === 'prevention'),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">
          La muscu suit les phases du plan course <UiInfoHint term="phaseMuscu" />
        </span>
        <span class="mono text-[11.5px] text-text-muted">
          phase actuelle : {{ PHASE_LABELS[data?.phaseType ?? ''] ?? data?.phaseType }} ·
          {{ data?.strengthPhaseLabel }} · semaine {{ data?.weekInPhase }}
        </span>
        <span class="pill ml-auto">{{ data?.dose.sets }} × {{ data?.dose.reps }}</span>
        <span class="pill">{{ data?.dose.intensity }}</span>
      </div>

      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in ['Phase course', 'Phase muscu', 'Séances par semaine']"
              :key="head"
              class="label pb-2 text-[10px]"
            >
              {{ head }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data?.phasePlan ?? []"
            :key="row.type"
            class="border-t border-line-soft"
            :class="row.type === data?.phaseType && 'text-accent'"
          >
            <td class="py-[6px]">{{ PHASE_LABELS[row.type] ?? row.type }}</td>
            <td class="py-[6px]">{{ STRENGTH_PHASE_LABELS[row.strengthPhase] }}</td>
            <td class="mono py-[6px]">{{ row.sessions }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div v-for="item in data?.sessions ?? []" :key="item.code" class="tile">
        <div class="flex items-baseline gap-3">
          <span class="display text-[20px] font-semibold">{{ item.label }}</span>
          <span v-if="planned.has(item.code)" class="pill bg-accent/15 text-accent">
            cette semaine
          </span>
          <span class="pill ml-auto">RPE {{ item.prescription.expectedRpe }}</span>
          <span class="pill">{{ formatMinutes(item.prescription.durationMin) }}</span>
        </div>

        <p class="text-[13px] text-text-muted">{{ item.note }}</p>

        <div class="flex flex-col gap-2 border-t border-line-soft pt-2">
          <div
            v-for="step in item.prescription.steps"
            :key="step.label"
            class="flex flex-col gap-px rounded-sm border border-transparent px-1"
            :class="step.exerciseId && 'tile-action -mx-1'"
            :role="step.exerciseId ? 'button' : undefined"
            :tabindex="step.exerciseId ? 0 : undefined"
            @click="step.exerciseId && ui.openExercise(step.exerciseId)"
            @keydown.enter.prevent="step.exerciseId && ui.openExercise(step.exerciseId)"
            @keydown.space.prevent="step.exerciseId && ui.openExercise(step.exerciseId)"
          >
            <span class="flex items-baseline gap-2">
              <span class="text-[13px]">{{ step.label }}</span>
              <span v-if="step.repeats && step.reps" class="mono text-[12px] text-text-dim">
                {{ step.repeats }} × {{ step.reps }}{{ step.isometric ? '″' : ''
                }}{{ step.unilateral ? '/côté' : '' }}
              </span>
              <span v-else-if="step.durationS" class="mono text-[12px] text-text-dim">
                {{ formatMinutes(step.durationS / 60) }}
              </span>
              <span v-if="step.superset" class="pill text-[10px]">
                superset <UiInfoHint term="superset" />
              </span>
              <span v-if="step.intensity" class="pill ml-auto">{{ step.intensity }}</span>
            </span>
            <span v-if="step.recoveryS || step.tempo" class="mono text-[11.5px] text-text-muted">
              <template v-if="step.tempo">tempo {{ step.tempo }} · </template>
              <template v-if="step.recoveryS">récup {{ step.recoveryS }}″</template>
            </span>
            <span v-if="step.note" class="text-[12px] text-text-muted">{{ step.note }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Exercices de prévention <UiInfoHint term="prevention" /></span>
        <span class="mono text-[11.5px] text-text-muted">
          en rotation à la fin de chaque séance chargée
        </span>
      </div>

      <div class="grid grid-cols-2 gap-x-6 gap-y-2">
        <div
          v-for="exercise in preventionBlock"
          :key="exercise.id"
          class="tile-action -mx-1 flex flex-col gap-px rounded-sm border border-transparent border-t-line-soft px-1 pt-2"
          role="button"
          :tabindex="0"
          @click="ui.openExercise(exercise.id)"
          @keydown.enter.prevent="ui.openExercise(exercise.id)"
          @keydown.space.prevent="ui.openExercise(exercise.id)"
        >
          <span class="flex items-baseline gap-2">
            <span class="text-[13px]">{{ exercise.label }}</span>
            <span class="mono text-[12px] text-text-dim">
              {{ exercise.sets }} × {{ exercise.reps }}{{ exercise.isometric ? '″' : '' }}
            </span>
          </span>
          <span class="text-[12px] text-text-muted">{{ exercise.why }}</span>
        </div>
      </div>
    </div>

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Charges tenues</span>
        <span class="mono text-[11.5px] text-text-muted">
          dernière charge saisie, par exercice
        </span>
      </div>

      <div
        v-if="Object.keys(data?.lastLoadsKg ?? {}).length === 0"
        class="text-[13px] text-text-muted"
      >
        Aucune série saisie pour l'instant. Les charges apparaîtront après la première séance
        enregistrée depuis le cockpit.
      </div>

      <table v-else class="w-full text-[13px]">
        <tbody>
          <tr
            v-for="(loadKg, exerciseId) in data?.lastLoadsKg ?? {}"
            :key="exerciseId"
            class="border-t border-line-soft"
          >
            <td class="py-[6px]">
              {{ data?.exercises.find((item) => item.id === exerciseId)?.label ?? exerciseId }}
            </td>
            <td class="mono py-[6px] text-right">{{ formatLoad(loadKg) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
