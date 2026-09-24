<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

/** Ce qu'une course a besoin de montrer dans une journée (§ 8). */
export interface DayRace {
  id: number
  name: string
  distanceM: number
}

withDefaults(
  defineProps<{
    label: string
    date: string
    sessions: PlanSession[]
    race?: DayRace
    isToday?: boolean
    compact?: boolean
  }>(),
  { race: undefined, isToday: false, compact: false },
)

const ui = useUiStore()
const plan = usePlanStore()

/**
 * Le seul chiffre de la cellule est celui du réalisé dès que la séance est
 * faite et mesurée : ce qu'on avait demandé n'intéresse plus (§ 8, P7.4).
 * Une séance sans kilométrage se lit en durée — vélo et muscu.
 */
function figureOf(session: PlanSession): string {
  const done = session.status === 'faite'

  if (session.prescription.totalDistanceM > 0) {
    return formatDistance(
      done && session.actualDistanceM !== null
        ? session.actualDistanceM
        : session.prescription.totalDistanceM,
    )
  }

  return formatMinutes(
    done && session.actualDurationMin !== null
      ? session.actualDurationMin
      : session.prescription.durationMin,
  )
}
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-md border p-3"
    :class="[
      compact ? 'min-h-[84px]' : 'min-h-[104px]',
      isToday ? 'border-accent/45 bg-surface-raised' : 'border-line-soft bg-surface-inset',
    ]"
  >
    <span class="label text-caption">{{ label }}</span>

    <!-- Le jour d'une course porte la course, et non le repos que le générateur
         y pose : c'est le seul jour de la semaine qui ne s'entraîne pas et qui
         compte quand même (§ 8). -->
    <div
      v-if="race"
      class="tap tile-action -mx-1 flex flex-col justify-center gap-px rounded-sm border border-transparent px-1"
      role="button"
      :tabindex="0"
      @click="ui.openModal('course', race.id)"
      @keydown.enter.prevent="ui.openModal('course', race.id)"
      @keydown.space.prevent="ui.openModal('course', race.id)"
    >
      <span class="flex items-center gap-[6px]">
        <UiAppIcon name="flag" :size="13" class="text-accent" label="Course" />
        <span
          class="display line-clamp-2 min-w-0 text-copy leading-[1.15] font-semibold text-accent lean:block lean:truncate lean:leading-normal"
        >
          {{ race.name }}
        </span>
      </span>
      <span class="mono pl-[19px] text-caption text-text-dim">
        {{ formatDistance(race.distanceM) }}
      </span>
    </div>

    <!-- Plusieurs séances le même jour : chacune porte l'icône de son sport et
         elles sont séparées par un filet, pour qu'on ne les confonde pas. -->
    <div
      v-for="(session, index) in sessions"
      :key="session.id"
      class="tap tile-action -mx-1 flex flex-col justify-center gap-px rounded-sm border border-transparent px-1"
      :class="(index > 0 || race) && 'mt-1 border-t-line-soft pt-2'"
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
        <!-- Sous la rupture le nom se plie sur deux lignes au lieu d'être
             rogné : c'est lui qu'on vient lire dans une colonne de jour
             (§ 8, P7.4). Au-dessus, la troncature d'origine. -->
        <span
          class="display line-clamp-2 min-w-0 text-copy leading-[1.15] font-semibold lean:block lean:truncate lean:leading-normal"
          :class="['sautee', 'annulee'].includes(session.status) && 'text-text-dim line-through'"
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
          <span class="text-meta text-text-dim">Séance clé</span>
        </UiHoverBubble>
      </span>
      <span class="mono flex flex-wrap items-center gap-x-1 pl-[19px] text-caption text-text-dim">
        <span class="whitespace-nowrap">{{ figureOf(session) }}</span>
        <!-- « · faite » devient une coche : le mot ne s'écrit plus (§ 8, P6.35).
             Sous 80 % du prescrit, la coche passe à l'ambre, sans légende (P20). -->
        <UiAppIcon
          v-if="session.status === 'faite'"
          name="check"
          :size="12"
          :class="isShortOfPrescription(session) ? 'text-warn' : 'text-ok'"
          :label="isShortOfPrescription(session) ? 'Faite, sous le prescrit' : 'Faite'"
        />
        <!-- Ni faite ni sautée, et son jour est passé : elle attend son retour (P20). -->
        <span
          v-else-if="isAwaitingFeedback(session, plan.today)"
          class="flex items-baseline gap-1 text-warn wide:whitespace-nowrap"
        >
          <span
            class="block h-[5px] w-[5px] shrink-0 self-center rounded-full bg-warn"
            aria-hidden="true"
          />
          à renseigner
        </span>
      </span>
    </div>

    <!-- Un jour de repos a son détail, lui aussi : ses repas (§ 9, P6.4). -->
    <button
      v-if="sessions.length === 0 && !race"
      type="button"
      class="tile-action -mx-1 flex-1 rounded-sm border border-transparent px-1 text-left text-meta text-text-dim"
      @click="ui.openDay(date)"
    >
      repos
    </button>
  </div>
</template>
