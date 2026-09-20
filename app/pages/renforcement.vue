<script setup lang="ts">
const { data } = await useFetch('/api/library/strength')
const ui = useUiStore()

const planned = computed(() => new Set(data.value?.plannedCodes ?? []))

const preventionBlock = computed(() =>
  (data.value?.exercises ?? []).filter((exercise) => exercise.group === 'prevention'),
)

/**
 * Une charge par exercice travaillé, du plus récemment tenu au plus ancien :
 * l'API construit la table dans cet ordre, la page le garde. Trente et un
 * exercices tiennent la tuile sur 750 px — elle n'en montre plus que dix (§ 8).
 */
const PER_PAGE = 10
const loadRows = computed(() =>
  Object.entries(data.value?.lastLoadsKg ?? {}).map(([exerciseId, loadKg]) => ({
    exerciseId,
    loadKg,
    label: data.value?.exercises.find((item) => item.id === exerciseId)?.label ?? exerciseId,
  })),
)

const loads = usePagedList(() => loadRows.value, PER_PAGE)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">
          <UiInfoHint term="phaseMuscu">Le renforcement suit les phases du plan course</UiInfoHint>
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
    <div class="fold-4 grid gap-4">
      <button
        v-for="item in data?.sessions ?? []"
        :key="item.code"
        type="button"
        class="tile tile-action text-left"
        @click="ui.openStrengthSession(item.code)"
      >
        <span class="flex items-baseline gap-2">
          <span class="display truncate text-[17px] font-semibold">{{ item.label }}</span>
          <UiHoverBubble
            v-if="planned.has(item.code)"
            label="Prévue cette semaine"
            size="sm"
            trigger-class="ml-auto"
          >
            <template #trigger>
              <span class="block h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
            </template>
            <span class="text-[12.5px] text-text-dim">Prévue cette semaine</span>
          </UiHoverBubble>
        </span>
        <span class="mono text-[12px] text-text-dim">
          {{ formatMinutes(item.prescription.durationMin) }} · RPE
          {{ item.prescription.expectedRpe }} · {{ item.prescription.steps.length }} ex.
        </span>
      </button>
    </div>

    <div class="tile">
      <span class="label"><UiInfoHint term="prevention">Exercices de prévention</UiInfoHint></span>

      <div class="fold-2 grid gap-x-6 gap-y-2">
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
            <UiNoteHint :title="exercise.label" :text="exercise.why">
              <span class="text-[13px]">{{ exercise.label }}</span>
            </UiNoteHint>
            <span class="mono text-[12px] text-text-dim">
              {{ exercise.sets }} × {{ exercise.reps }}{{ exercise.isometric ? '″' : '' }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <div class="tile">
      <span class="label"><UiInfoHint term="chargeMuscu">Charges tenues</UiInfoHint></span>

      <div v-if="loads.total === 0" class="text-[13px] text-text-dim">Aucune série saisie.</div>

      <template v-else>
        <UiAxisScroller>
          <table class="table-axis w-full text-[13px]">
            <tbody>
              <tr
                v-for="row in loads.items"
                :key="row.exerciseId"
                class="border-t border-line-soft"
              >
                <td class="py-[6px]">{{ row.label }}</td>
                <td class="mono py-[6px] text-right">{{ formatLoad(row.loadKg) }}</td>
              </tr>
            </tbody>
          </table>
        </UiAxisScroller>

        <UiPager v-model="loads.page" :total="loads.total" :per-page="PER_PAGE" />
      </template>
    </div>
  </div>
</template>
