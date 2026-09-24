<script setup lang="ts">
import { LOAD_IMPLEMENTS, LoadImplement } from '~~/server/domain/strength/estimated-max'

/**
 * Le calage d'un exercice sans estimation (P26) : des paliers de cinq
 * répétitions, la barre à vide puis + 10 kg tant que ça reste rapide, puis
 * + 5 kg. Au dernier, combien restait-il sous le pied ? Le maximum s'en
 * déduit, sans test à l'échec. Le calage remplace l'échauffement, pas la
 * séance.
 */
const props = defineProps<{ exerciseId: string; sessionId: number | null }>()

const ui = useUiStore()
const { data: library } = await useFetch('/api/library/strength')

const label = computed(
  () => library.value?.exercises.find((item) => item.id === props.exerciseId)?.label ?? '',
)

const barbell = computed(() => LOAD_IMPLEMENTS[props.exerciseId] === LoadImplement.Barbell)

/** Deux allures de montée : franche tant que ça va vite, fine quand ça ralentit. */
const steps = computed(() =>
  barbell.value ? { start: 20, fast: 10, slow: 5 } : { start: 4, fast: 4, slow: 2 },
)

const REPS = 5
const paliers = ref([{ loadKg: steps.value.start, reps: REPS }])

enum Stage {
  Steps = 'paliers',
  Reserve = 'reserve',
  Result = 'resultat',
}
const stage = ref(Stage.Steps)
const farFromFailure = ref(false)
const error = ref('')

function addStep(increment: number) {
  const last = paliers.value.at(-1)!
  paliers.value.push({ loadKg: last.loadKg + increment, reps: REPS })
  farFromFailure.value = false
}

const RESERVES = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4+' },
]

interface CalibrationResult {
  maxKg: number
  phases: {
    label: string
    startDate: string
    intensity: string
    loadKg: number
    plates: number[] | null
  }[]
}
const result = ref<CalibrationResult | null>(null)

/**
 * À quatre en réserve ou plus, Epley se dégrade loin de l'échec : la feuille
 * demande un palier de plus au lieu d'estimer.
 */
async function chooseReserve(reserve: number) {
  error.value = ''
  if (reserve >= 4) {
    addStep(steps.value.slow)
    farFromFailure.value = true
    stage.value = Stage.Steps
    return
  }
  try {
    result.value = await $fetch<CalibrationResult>('/api/strength/calibrations', {
      method: 'POST',
      body: { exerciseId: props.exerciseId, steps: paliers.value, reserve },
    })
    stage.value = Stage.Result
  } catch (failure) {
    error.value = apiMessage(failure, 'Calage impossible.')
  }
}

const platesText = (plates: number[] | null) =>
  plates && plates.length > 0
    ? `${plates.map((plate) => formatDecimal(plate)).join(' + ')} kg par côté`
    : plates
      ? 'barre à vide'
      : ''

function backToSession() {
  if (props.sessionId) ui.openModal('seance', props.sessionId)
  else ui.closeModal()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-display-s font-semibold">{{ label }}</span>
      <span class="mono text-meta text-text-dim">{{ result ? 'calé' : 'à caler' }}</span>
    </div>

    <template v-if="stage !== Stage.Result">
      <p class="text-body text-text-dim">
        Des paliers de {{ REPS }} répétitions :
        {{ barbell ? 'la barre à vide' : `${steps.start} kg par haltère` }}, puis +
        {{ steps.fast }} kg tant que ça reste rapide, puis + {{ steps.slow }} kg. Le calage remplace
        l'échauffement, pas la séance.
      </p>

      <div class="tile bg-surface-inset">
        <div
          v-for="(palier, index) in paliers"
          :key="index"
          class="grid grid-cols-[auto_1fr_1fr] items-center gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
        >
          <span class="label text-caption">Palier {{ index + 1 }}</span>
          <label class="flex items-center gap-2">
            <input
              :id="`palier-kg-${index}`"
              v-model.number="palier.loadKg"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              class="input mono"
            />
            <span class="mono text-meta text-text-dim">kg</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              :id="`palier-reps-${index}`"
              v-model.number="palier.reps"
              type="number"
              inputmode="numeric"
              min="1"
              max="12"
              class="input mono"
            />
            <span class="mono text-meta text-text-dim">rép.</span>
          </label>
        </div>
      </div>

      <p v-if="farFromFailure" class="text-body text-warn">
        Quatre en réserve ou plus, c'est trop loin de l'échec pour estimer juste : un palier de
        plus.
      </p>

      <template v-if="stage === Stage.Steps">
        <div class="flex flex-col gap-2 lean:flex-row">
          <button type="button" class="btn btn-ghost flex-1" @click="addStep(steps.fast)">
            + {{ steps.fast }} kg, ça reste rapide
          </button>
          <button type="button" class="btn btn-ghost flex-1" @click="addStep(steps.slow)">
            + {{ steps.slow }} kg, ça ralentit
          </button>
        </div>
        <button type="button" class="btn btn-lg" @click="stage = Stage.Reserve">
          C'était le dernier palier
        </button>
      </template>

      <div v-else class="flex flex-col gap-2">
        <span class="label text-caption">
          <UiInfoHint term="reserve">Au dernier palier, combien en réserve ?</UiInfoHint>
        </span>
        <div class="grid grid-cols-5 gap-2">
          <UiActionButton
            v-for="option in RESERVES"
            :key="option.value"
            class="btn btn-ghost mono"
            :action="() => chooseReserve(option.value)"
          >
            {{ option.label }}
          </UiActionButton>
        </div>
        <p v-if="error" class="text-body text-warn">{{ error }}</p>
      </div>
    </template>

    <template v-else-if="result">
      <div class="tile bg-surface-inset">
        <span class="label text-caption">Maximum estimé</span>
        <span class="display text-display-m font-bold">{{ formatLoad(result.maxKg) }}</span>
      </div>

      <!-- La charge du jour, puis celles des phases qui viennent : le calage
           dit tout de suite où le cycle va mener. -->
      <div class="tile bg-surface-inset">
        <div
          v-for="(phase, index) in result.phases"
          :key="phase.startDate"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
        >
          <span class="text-body">{{ index === 0 ? 'Aujourd’hui' : phase.label }}</span>
          <span class="mono text-meta text-text-dim">
            {{ index === 0 ? phase.label : `dès le ${formatDate(phase.startDate)}` }} ·
            {{ phase.intensity }}
          </span>
          <span class="mono ml-auto text-title" :class="index === 0 && 'text-accent'">
            {{ formatLoad(phase.loadKg) }}
          </span>
          <span v-if="phase.plates" class="mono w-full text-right text-meta text-text-dim">
            {{ platesText(phase.plates) }}
          </span>
        </div>
      </div>

      <button type="button" class="btn btn-lg" @click="backToSession">
        {{ sessionId ? 'Revenir à la séance' : 'Fermer' }}
      </button>
    </template>
  </div>
</template>
