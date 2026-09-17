<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const props = defineProps<{ session: PlanSession; muted?: boolean; actionable?: boolean }>()
const ui = useUiStore()

const sport = computed(() => sportStyle(props.session.sport))

/** Une séance sans kilométrage se lit en durée : vélo et muscu. */
const volume = computed(() =>
  props.session.prescription.totalDistanceM > 0
    ? formatDistance(props.session.prescription.totalDistanceM)
    : '—',
)

const minutes = computed(() => prescribedMinutes(props.session.prescription))

const label = computed(() => SESSION_LABELS[props.session.code] ?? props.session.code)

/**
 * Structure de la séance, en une ligne : ce qu'elle contient, pas son détail.
 * Une séance d'une seule étape qui répète son nom ne dit rien de plus.
 */
const structure = computed(() => {
  const steps = props.session.prescription.steps.map(
    (step) => `${step.repeats ? `${step.repeats} × ` : ''}${step.label}`,
  )
  if (steps.length === 1 && steps[0] === label.value) return ''
  return steps.join(' · ')
})
</script>

<template>
  <!-- Anatomie de la maquette : nom et structure à gauche, trois chiffres au
       milieu, l'action seule à droite (§ 9, P5.19). -->
  <div
    class="tile-action grid grid-cols-[1.3fr_1fr_auto] items-center gap-3 rounded-md border border-transparent border-t-line-soft px-2 py-[10px] first:border-t-transparent"
    role="button"
    :tabindex="0"
    @click="ui.openModal('seance', session.id)"
    @keydown.enter.prevent="ui.openModal('seance', session.id)"
    @keydown.space.prevent="ui.openModal('seance', session.id)"
  >
    <div class="flex min-w-0 items-center gap-3">
      <UiAppIcon
        :name="sport.icon"
        :size="18"
        :class="sport.tone"
        :title="SPORT_LABELS[session.sport] ?? session.sport"
      />
      <div class="flex min-w-0 flex-col gap-px">
        <span class="display flex items-center gap-2 text-[17px] font-semibold">
          <span :class="muted && 'text-text-dim'">{{ label }}</span>
          <span v-if="session.key" class="pill bg-accent/15 text-[10px] text-accent">clé</span>
        </span>
        <span v-if="structure" class="mono truncate text-[11.5px] text-text-muted">
          {{ structure }}
        </span>
        <span v-else class="mono text-[11.5px] text-text-muted">
          {{ SPORT_LABELS[session.sport] ?? session.sport }}
        </span>
      </div>
    </div>

    <div class="flex items-baseline justify-between gap-2">
      <span class="mono text-[13px]">{{ volume }}</span>
      <span class="mono text-[13px] text-text-dim">{{ formatMinutes(minutes) }}</span>
      <span class="mono text-[13px] text-text-muted">
        RPE {{ session.prescription.expectedRpe }}
      </span>
    </div>

    <div class="flex items-center gap-3">
      <span v-if="session.status === 'faite'" class="pill pill-done">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill">manquée</span>
      <button
        v-if="actionable"
        type="button"
        class="btn"
        :class="session.status === 'faite' && 'btn-ghost'"
        @click.stop="ui.openModal('seance', session.id)"
      >
        {{ session.status === 'faite' ? 'Modifier le ressenti' : 'Compléter le ressenti' }}
      </button>
    </div>
  </div>
</template>
