<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const props = defineProps<{ session: PlanSession; muted?: boolean; actionable?: boolean }>()
const ui = useUiStore()

const sport = computed(() => sportStyle(props.session.sport))

/** Une séance sans kilométrage se lit en durée : vélo et muscu. */
const volume = computed(() =>
  props.session.prescription.totalDistanceM > 0
    ? formatDistance(props.session.prescription.totalDistanceM)
    : formatMinutes(props.session.prescription.durationMin),
)
</script>

<template>
  <div class="flex items-center gap-3 border-t border-line-soft py-[10px] first:border-t-0">
    <UiAppIcon
      :name="sport.icon"
      :size="18"
      :class="sport.tone"
      :title="SPORT_LABELS[session.sport] ?? session.sport"
    />

    <div class="flex min-w-0 flex-col gap-px">
      <span class="display flex items-center gap-2 text-[17px] font-semibold">
        <span :class="muted && 'text-text-dim'">
          {{ SESSION_LABELS[session.code] ?? session.code }}
        </span>
        <span v-if="session.key" class="pill bg-accent/15 text-[10px] text-accent">clé</span>
      </span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ SPORT_LABELS[session.sport] ?? session.sport }} · {{ volume }}
        <template v-for="step in session.prescription.steps" :key="step.label">
          <template v-if="step.paceSecPerKm && step.label !== 'Retour au calme'">
            · {{ step.repeats ? `${step.repeats} × ` : '' }}{{ formatPace(step.paceSecPerKm) }}/km
          </template>
        </template>
      </span>
    </div>

    <div class="ml-auto flex items-center gap-3">
      <span v-if="session.status === 'faite'" class="pill pill-done">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill">manquée</span>
      <span v-else class="pill">RPE {{ session.prescription.expectedRpe }}</span>
      <button
        v-if="actionable"
        type="button"
        class="btn"
        :class="session.status === 'faite' && 'btn-ghost'"
        @click="ui.openPanel('retour', session.id)"
      >
        {{ session.status === 'faite' ? 'Modifier le ressenti' : 'Compléter le ressenti' }}
      </button>
    </div>
  </div>
</template>
