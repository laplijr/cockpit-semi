<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

withDefaults(
  defineProps<{
    label: string
    date: string
    sessions: PlanSession[]
    isToday?: boolean
    compact?: boolean
  }>(),
  { isToday: false, compact: false },
)

const ui = useUiStore()
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
      class="tile-action -mx-1 flex flex-col gap-px rounded-sm border border-transparent px-1"
      :class="index > 0 && 'mt-1 border-t-line-soft pt-2'"
      role="button"
      :tabindex="0"
      @click="ui.openModal('seance', session.id)"
      @keydown.enter.prevent="ui.openModal('seance', session.id)"
      @keydown.space.prevent="ui.openModal('seance', session.id)"
    >
      <span class="flex items-center gap-[6px]">
        <UiAppIcon
          :name="sportStyle(session.sport).icon"
          :size="13"
          :class="sportStyle(session.sport).tone"
          :label="SPORT_LABELS[session.sport] ?? session.sport"
        />
        <span
          class="display truncate text-[15px] font-semibold"
          :class="session.status === 'sautee' && 'text-text-dim line-through'"
        >
          {{ SESSION_LABELS[session.code] ?? session.code }}
        </span>
        <!-- Une séance clé se marque d'un point accent : la pastille disait le
             même mot que la couleur (§ 8, P6.35). Le point suit l'icône, la
             troncature du nom ne doit jamais l'emporter. -->
        <UiHoverBubble v-if="session.key" label="Séance clé" size="sm" trigger-class="ml-auto">
          <template #trigger>
            <span class="block h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
          </template>
          <span class="text-[12.5px] text-text-dim">Séance clé</span>
        </UiHoverBubble>
      </span>
      <span class="mono flex items-center gap-1 pl-[19px] text-[11px] text-text-dim">
        <!-- Une séance sans kilométrage se lit en durée : vélo et muscu. -->
        {{
          session.prescription.totalDistanceM > 0
            ? formatDistance(session.prescription.totalDistanceM)
            : formatMinutes(session.prescription.durationMin)
        }}
        <!-- « · faite » devient une coche : le mot ne s'écrit plus (§ 8, P6.35). -->
        <UiAppIcon
          v-if="session.status === 'faite'"
          name="check"
          :size="12"
          class="text-ok"
          label="Faite"
        />
      </span>
    </div>

    <!-- Un jour de repos a son détail, lui aussi : ses repas (§ 9, P6.4). -->
    <button
      v-if="sessions.length === 0"
      type="button"
      class="tile-action -mx-1 flex-1 rounded-sm border border-transparent px-1 text-left text-[12px] text-text-dim"
      @click="ui.openDay(date)"
    >
      repos
    </button>
  </div>
</template>
