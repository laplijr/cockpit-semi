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
          Le renforcement suit les phases du plan course <UiInfoHint term="phaseMuscu" />
        </span>
        <span class="mono text-[11.5px] text-text-dim">
          {{ PHASE_LABELS[data?.phaseType ?? ''] ?? data?.phaseType }} ·
          {{ data?.strengthPhaseLabel }} · semaine {{ data?.weekInPhase }}
        </span>
        <span class="pill ml-auto">{{ data?.dose.sets }} × {{ data?.dose.reps }}</span>
        <span class="pill">{{ data?.dose.intensity }}</span>
      </div>

      <UiPhaseRail :allowed="data?.phaseType ? [data.phaseType] : []" />
    </div>

    <!-- La page est un index : huit cartes de deux lignes. Le détail, avec la
         liste des exercices, vit dans le dialog (§ 8, P6.35). -->
    <div class="grid grid-cols-4 gap-4">
      <button
        v-for="item in data?.sessions ?? []"
        :key="item.code"
        type="button"
        class="tile tile-action text-left"
        @click="ui.openStrengthSession(item.code)"
      >
        <span class="flex items-baseline gap-2">
          <span class="display truncate text-[17px] font-semibold">{{ item.label }}</span>
          <span
            v-if="planned.has(item.code)"
            class="ml-auto h-[6px] w-[6px] shrink-0 rounded-full bg-accent"
            title="Prévue cette semaine"
          />
        </span>
        <span class="mono text-[12px] text-text-dim">
          {{ formatMinutes(item.prescription.durationMin) }} · RPE
          {{ item.prescription.expectedRpe }} · {{ item.prescription.steps.length }} ex.
        </span>
      </button>
    </div>

    <div class="tile">
      <span class="label">Exercices de prévention <UiInfoHint term="prevention" /></span>

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
            <UiNoteHint :title="exercise.label" :text="exercise.why" />
          </span>
        </div>
      </div>
    </div>

    <div class="tile">
      <span class="label">Charges tenues <UiInfoHint term="chargeMuscu" /></span>

      <div
        v-if="Object.keys(data?.lastLoadsKg ?? {}).length === 0"
        class="text-[13px] text-text-dim"
      >
        Aucune série saisie.
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
