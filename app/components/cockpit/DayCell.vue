<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

withDefaults(
  defineProps<{
    label: string
    sessions: PlanSession[]
    isToday?: boolean
    compact?: boolean
  }>(),
  { isToday: false, compact: false },
)
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-md border p-3"
    :class="[
      compact ? 'min-h-[84px]' : 'min-h-[104px]',
      isToday ? 'border-accent/45 bg-surface-raised' : 'border-line-soft bg-surface-inset',
    ]"
  >
    <span class="label text-[10px]">{{ label }}</span>

    <!-- Plusieurs séances le même jour : chacune porte l'icône de son sport et
         elles sont séparées par un filet, pour qu'on ne les confonde pas. -->
    <div
      v-for="(session, index) in sessions"
      :key="session.id"
      class="flex flex-col gap-px"
      :class="index > 0 && 'border-t border-line-soft pt-2'"
    >
      <span class="flex items-center gap-[6px]">
        <UiAppIcon
          :name="sportStyle(session.sport).icon"
          :size="13"
          :class="sportStyle(session.sport).tone"
          :title="SPORT_LABELS[session.sport] ?? session.sport"
        />
        <span
          class="display truncate text-[15px] font-semibold"
          :class="session.status === 'sautee' && 'text-text-muted line-through'"
        >
          {{ SESSION_LABELS[session.code] ?? session.code }}
        </span>
      </span>
      <span class="mono pl-[19px] text-[11px] text-text-muted">
        <!-- Une séance sans kilométrage se lit en durée : vélo et muscu. -->
        {{
          session.prescription.totalDistanceM > 0
            ? formatDistance(session.prescription.totalDistanceM)
            : formatMinutes(session.prescription.durationMin)
        }}
        <template v-if="session.status === 'faite'"> · faite</template>
      </span>
    </div>

    <span v-if="sessions.length === 0" class="text-[12px] text-text-muted">repos</span>
  </div>
</template>
