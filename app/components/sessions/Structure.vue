<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'
import { reserveLabel, targetReserve } from '~~/server/domain/strength/reserve'

/** Ce que la fenêtre sait d'un exercice : sa charge, son format, ses disques (P26). */
interface ExerciseState {
  lastLoadKg: number | null
  suggestedLoadKg: number | null
  lastReps: number | null
  suggestedReps: number | null
  toCalibrate: boolean
  plates: number[] | null
}

const { session, states } = defineProps<{
  session: PlanSession
  states: Record<string, ExerciseState>
}>()

const ui = useUiStore()

const loads = computed(() =>
  Object.fromEntries(Object.entries(states).filter(([, item]) => item.lastLoadKg !== null)),
)

/**
 * Au poids de corps, il n'y a pas de charge à proposer : c'est le format qui
 * progresse, et il s'affiche à la même place (§ 5, P11.3).
 */
const formats = computed(() =>
  Object.fromEntries(
    Object.entries(states).filter(
      ([, item]) => item.lastLoadKg === null && item.suggestedReps !== null,
    ),
  ),
)

/**
 * La pill d'un exercice dosé : la charge proposée, avec la réserve en second,
 * quand une charge est connue ; la réserve seule sinon ; le repère tel quel
 * quand il ne se dose pas en réserve (« à vide »).
 */
function loadPill(step: PlanSession['prescription']['steps'][number]): string {
  const reserve = targetReserve(step.intensity)
  const state = step.exerciseId ? states[step.exerciseId] : undefined
  if (state?.toCalibrate) return 'à caler'
  const known = state?.suggestedLoadKg ?? null
  if (known && reserve !== null) return `${formatLoad(known)} · ${reserveLabel(reserve)}`
  if (known) return formatLoad(known)
  return reserve === null ? step.intensity! : reserveLabel(reserve)
}
</script>

<template>
  <div class="tile order-1 bg-surface-inset lean:order-none">
    <span class="label text-caption">Structure</span>
    <!-- Un exercice montre ce qu'on va faire : sa pose clé, et la ligne
         ouvre sa fiche. L'échauffement, sans exercice, ne change pas (P25). -->
    <component
      :is="step.exerciseId ? 'button' : 'div'"
      v-for="step in session.prescription.steps"
      :key="step.label"
      :type="step.exerciseId ? 'button' : undefined"
      class="flex gap-3 border-t border-line-soft pt-2 text-left first:border-t-0 first:pt-0"
      :class="
        step.exerciseId &&
        'tap tile-action -mx-1 rounded-sm border-x border-b border-x-transparent border-b-transparent px-1'
      "
      @click="step.exerciseId && ui.openExercise(step.exerciseId)"
    >
      <UiExerciseFigure
        v-if="step.exerciseId"
        :exercise-id="step.exerciseId"
        still
        :width="36"
        class="shrink-0 self-start"
      />
      <span class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="flex items-baseline gap-2">
          <span class="text-body">
            <template v-if="step.repeats && !step.exerciseId">{{ step.repeats }} × </template>
            {{ step.label }}
          </span>
          <span
            v-if="step.repeats && step.reps"
            class="mono whitespace-nowrap text-meta text-text-dim"
          >
            {{ step.repeats }} × {{ step.reps }}{{ step.isometric ? '″' : ''
            }}{{ step.unilateral ? '/côté' : '' }}
          </span>
          <span v-if="step.superset" class="pill text-caption">superset</span>
          <!-- Les kilos quand ils sont connus, la réserve sinon : le
             pourcentage d'un maximum jamais mesuré ne dit quel poids
             prendre à personne. Il reste dans la bulle (P25). -->
          <UiHoverBubble
            v-if="step.intensity"
            :label="step.intensity"
            size="sm"
            trigger-class="ml-auto shrink-0"
          >
            <template #trigger>
              <span class="pill explicable text-caption">{{ loadPill(step) }}</span>
            </template>
            <span class="mono text-meta text-text-dim">{{ step.intensity }} du maximum</span>
          </UiHoverBubble>
        </span>
        <span class="mono text-meta text-text-dim">
          <template v-if="step.distanceM">{{ formatDistance(step.distanceM) }}</template>
          <template v-if="step.durationS && !step.reps">
            · {{ formatSeconds(step.durationS) }}
          </template>
          <template v-if="step.paceSecPerKm"> · {{ formatPace(step.paceSecPerKm) }}/km </template>
          <template v-if="step.tempo"> · tempo {{ step.tempo }}</template>
          <template v-if="step.recoveryS"> · récup {{ formatSeconds(step.recoveryS) }}</template>
          <template v-if="loads[step.exerciseId ?? '']">
            ·
            <span class="text-text-dim line-through">
              {{ formatLoad(loads[step.exerciseId!]!.lastLoadKg) }}
            </span>
            <span v-if="!step.intensity" class="ml-1 text-accent">
              {{ formatLoad(loads[step.exerciseId!]!.suggestedLoadKg) }}
            </span>
          </template>
          <template v-else-if="formats[step.exerciseId ?? '']">
            ·
            <span class="text-text-dim line-through">
              {{ step.repeats }} × {{ formats[step.exerciseId!]!.lastReps
              }}{{ step.isometric ? '″' : '' }}
            </span>
            <span class="ml-1 text-accent">
              {{ step.repeats }} × {{ formats[step.exerciseId!]!.suggestedReps
              }}{{ step.isometric ? '″' : '' }}
            </span>
          </template>
        </span>
        <!-- Un remplacement se dit sous l'exercice qu'on fait, pas ailleurs. -->
        <span v-if="step.replacesLabel" class="text-meta text-text-dim">
          Remplace {{ step.replacesLabel }} : le matériel qu'il demande n'est pas déclaré.
        </span>
        <!-- Les disques sous la charge, pour un exercice à la barre (P26). -->
        <span
          v-if="step.exerciseId && states[step.exerciseId]?.plates?.length"
          class="mono text-meta text-text-dim"
        >
          {{ states[step.exerciseId]!.plates!.map((plate) => formatDecimal(plate)).join(' + ') }}
          kg par côté
        </span>
        <span v-if="step.note" class="text-meta text-text-dim">{{ step.note }}</span>
      </span>
    </component>
  </div>
</template>
