<script setup lang="ts">
import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'
import { RACE_DISTANCES_M, vdotFromEasyPace, vdotFromRace } from '~~/server/domain/fitness/vdot'

const value = defineModel<FitnessStartValue>({ required: true })

/**
 * Hors onboarding, « je ne sais pas » disparaît : il n'écrit rien, il ne veut
 * plus rien dire une fois qu'on vient déclarer quelque chose (§ 9, P7.5).
 */
const { allowUnknown = true } = defineProps<{ allowUnknown?: boolean }>()

const DISTANCES = [
  { label: '5 km', value: RACE_DISTANCES_M.fiveK },
  { label: '10 km', value: RACE_DISTANCES_M.tenK },
  { label: 'Semi-marathon', value: RACE_DISTANCES_M.halfMarathon },
  { label: 'Marathon', value: RACE_DISTANCES_M.marathon },
]

const ALL_CHOICES = [
  {
    kind: FitnessDeclaration.Chrono,
    label: 'J’ai un chrono de référence',
    hint: 'Une course courue à fond, dans les douze derniers mois.',
  },
  {
    kind: FitnessDeclaration.EasyPace,
    label: 'Je connais mon allure d’endurance',
    hint: 'L’allure à laquelle tu peux tenir une conversation.',
  },
  {
    kind: FitnessDeclaration.Unknown,
    label: 'Je ne sais pas',
    hint: 'Le plan démarre en endurance seule et pose un test de 20 minutes en semaine 2.',
  },
]

const CHOICES = computed(() =>
  allowUnknown
    ? ALL_CHOICES
    : ALL_CHOICES.filter((choice) => choice.kind !== FitnessDeclaration.Unknown),
)

/** Le VDOT que produirait la réponse en cours : la conséquence se lit avant de valider. */
const preview = computed(() => {
  if (!fitnessStartIsAnswered(value.value)) return null
  if (value.value.kind === FitnessDeclaration.Chrono) {
    return vdotFromRace(value.value.distanceM, chronoSeconds(value.value)!)
  }
  if (value.value.kind === FitnessDeclaration.EasyPace) {
    return vdotFromEasyPace(easyPaceSeconds(value.value)!)
  }
  return null
})

/** Le plancher se dit dans la valeur, pas dans une incise qui traîne (§ 8). */
const previewLabel = computed(() => {
  if (preview.value === null) return ''
  const vdot = preview.value.toFixed(1).replace('.', ',')
  return value.value.kind === FitnessDeclaration.EasyPace ? `${vdot} (plancher)` : vdot
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <button
        v-for="choice in CHOICES"
        :key="choice.kind"
        type="button"
        class="tile tile-action text-left"
        :class="value.kind === choice.kind && 'border-accent'"
        :aria-pressed="value.kind === choice.kind"
        @click="value = { ...value, kind: choice.kind }"
      >
        <span class="text-copy">{{ choice.label }}</span>
        <span class="text-body text-text-dim">{{ choice.hint }}</span>
      </button>
    </div>

    <div v-if="value.kind === FitnessDeclaration.Chrono" class="fold-3 grid gap-4">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-caption">Distance</span>
        <select v-model.number="value.distanceM" class="input">
          <option v-for="item in DISTANCES" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-caption">Chrono</span>
        <input
          v-model="value.chrono"
          type="text"
          inputmode="numeric"
          class="input mono"
          placeholder="1:42:17"
        />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-caption">Date de la course</span>
        <input v-model="value.date" type="date" class="input mono" />
      </label>
    </div>

    <div v-else-if="value.kind === FitnessDeclaration.EasyPace" class="fold-2 grid gap-4">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-caption">Allure d’endurance (min:s par kilomètre)</span>
        <input
          v-model="value.pace"
          type="text"
          inputmode="numeric"
          class="input mono"
          placeholder="6:47"
        />
      </label>
      <p class="text-body text-text-dim">
        Une allure tenue en endurance borne la forme par le bas : elle ne la mesure pas. Le cockpit
        l’affiche comme un plancher jusqu’au premier test.
      </p>
    </div>

    <p v-if="previewLabel" class="text-body text-text-dim">
      <UiInfoHint term="vdot">VDOT</UiInfoHint> de départ :
      <span class="mono text-text">{{ previewLabel }}</span>
    </p>
  </div>
</template>
