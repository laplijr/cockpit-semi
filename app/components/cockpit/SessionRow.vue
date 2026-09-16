<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

defineProps<{ session: PlanSession; muted?: boolean }>()
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
    <span class="pill ml-auto">RPE {{ session.prescription.expectedRpe }}</span>
  </div>
</template>
