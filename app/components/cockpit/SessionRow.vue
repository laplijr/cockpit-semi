<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

defineProps<{ session: PlanSession; muted?: boolean; actionable?: boolean }>()
const ui = useUiStore()
</script>

<template>
  <div class="flex items-center gap-3 border-t border-line-soft py-[10px] first:border-t-0">
    <span
      class="size-2 shrink-0 rounded-full"
      :class="session.key ? 'bg-accent' : 'bg-line-strong'"
    />
    <div class="flex min-w-0 flex-col gap-px">
      <span class="display text-[17px] font-semibold" :class="muted && 'text-text-dim'">
        {{ SESSION_LABELS[session.code] ?? session.code }}
      </span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ formatDistance(session.prescription.totalDistanceM) }}
        <template v-for="step in session.prescription.steps" :key="step.label">
          <template v-if="step.paceSecPerKm && step.label !== 'Retour au calme'">
            · {{ step.repeats ? `${step.repeats} × ` : '' }}{{ formatPace(step.paceSecPerKm) }}/km
          </template>
        </template>
      </span>
    </div>

    <div class="ml-auto flex items-center gap-3">
      <span v-if="session.status === 'faite'" class="pill pill-done">faite</span>
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
