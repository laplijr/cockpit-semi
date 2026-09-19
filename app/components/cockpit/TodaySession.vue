<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

/**
 * La séance du jour est l'objet le plus important de l'écran (§ 8, P6.35) :
 * son nom à 38 px et trois chiffres, rien d'autre. La zone est un bouton et
 * « Ressenti » reste à côté — pas de bouton dans un bouton.
 */
const props = defineProps<{ session: PlanSession }>()

const ui = useUiStore()

const sport = computed(() => sportStyle(props.session.sport))

const label = computed(() => SESSION_LABELS[props.session.code] ?? props.session.code)

const minutes = computed(() => prescribedMinutes(props.session.prescription))

/** Une séance sans kilométrage se lit en durée seule : vélo et muscu. */
const distance = computed(() =>
  props.session.prescription.totalDistanceM > 0
    ? formatDistance(props.session.prescription.totalDistanceM)
    : '—',
)

/** L'allure de l'étape la plus longue : celle qui donne le ton de la séance. */
const pace = computed(() => {
  const paced = props.session.prescription.steps
    .filter((step) => step.paceSecPerKm)
    .sort((a, b) => (b.distanceM ?? b.durationS ?? 0) - (a.distanceM ?? a.durationS ?? 0))

  return paced[0]?.paceSecPerKm ? `${formatPace(paced[0].paceSecPerKm)}/km` : '—'
})

const figures = computed(() => [
  { key: 'distance', label: 'distance', value: distance.value },
  { key: 'duree', label: 'durée', value: formatMinutes(minutes.value) },
  { key: 'allure', label: 'allure cible', value: pace.value },
])

const done = computed(() => props.session.status === 'faite')
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      type="button"
      class="tile-action flex min-w-0 flex-1 items-center gap-4 rounded-md border border-transparent px-2 py-2 text-left"
      @click="ui.openModal('seance', session.id)"
    >
      <UiAppIcon
        :name="sport.icon"
        :size="22"
        :class="sport.tone"
        :label="SPORT_LABELS[session.sport] ?? session.sport"
      />

      <!-- `truncate` rogne l'overflow : sans interligne, les jambages du nom
           sont coupés en haut et en bas (§ 8, P6.35). -->
      <span class="display min-w-0 flex-1 truncate text-[38px] leading-[1.15] font-semibold">
        {{ label }}
      </span>

      <span v-if="session.key" class="pill shrink-0 bg-accent/15 text-accent">clé</span>
      <span v-if="done" class="pill pill-done shrink-0">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill shrink-0">manquée</span>

      <span class="flex shrink-0 gap-5">
        <span v-for="figure in figures" :key="figure.key" class="flex flex-col items-end">
          <span class="mono text-[17px]">{{ figure.value }}</span>
          <span class="label text-[9.5px]">{{ figure.label }}</span>
        </span>
      </span>
    </button>

    <button
      type="button"
      class="btn shrink-0"
      :class="done && 'btn-ghost'"
      @click="ui.openModal('seance', session.id)"
    >
      Ressenti
    </button>
  </div>
</template>
