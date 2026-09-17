<script setup lang="ts">
import { levelsAreOrdered } from '~~/server/domain/fitness/objective'

export interface ObjectiveLevelValues {
  ambitionS: number | null
  realisticS: number | null
  floorS: number | null
}

const props = defineProps<{
  /** Les trois bornes de la projection, quand elle existe. */
  proposed: ObjectiveLevelValues | null
  /** Record sur la distance, ou nul : sans lui le mode record n'est pas offert. */
  recordS: number | null
}>()

const mode = defineModel<string>('mode', { required: true })
const levels = defineModel<ObjectiveLevelValues>('levels', { required: true })

const LEVELS = [
  { key: 'ambitionS', label: 'Ambition', hint: 'le bon jour' },
  { key: 'realisticS', label: 'Réaliste', hint: 'ce que vise le plan' },
  { key: 'floorS', label: 'Plancher', hint: 'à ne pas manquer' },
] as const

const text = reactive({
  ambitionS: durationToText(levels.value.ambitionS),
  realisticS: durationToText(levels.value.realisticS),
  floorS: durationToText(levels.value.floorS),
})

/** Valeurs avant proposition, pour afficher l'ancienne barrée (§ 8). */
const replaced = ref<ObjectiveLevelValues | null>(null)

watch(
  text,
  () => {
    levels.value = {
      ambitionS: textToDuration(text.ambitionS),
      realisticS: textToDuration(text.realisticS),
      floorS: textToDuration(text.floorS),
    }
  },
  { deep: true },
)

function proposeFromProjection() {
  if (!props.proposed) return
  replaced.value = { ...levels.value }
  text.ambitionS = durationToText(props.proposed.ambitionS)
  text.realisticS = durationToText(props.proposed.realisticS)
  text.floorS = durationToText(props.proposed.floorS)
}

const misordered = computed(() => mode.value === 'temps' && !levelsAreOrdered(levels.value))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-4 gap-3">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Objectif <UiInfoHint term="objectif" /></span>
        <select v-model="mode" class="input">
          <option value="temps">Chrono cible</option>
          <option value="record" :disabled="recordS === null">Battre mon record</option>
        </select>
      </label>

      <template v-if="mode === 'temps'">
        <label v-for="level in LEVELS" :key="level.key" class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">
            {{ level.label }}
            <span
              v-if="replaced && replaced[level.key] !== null"
              class="mono text-text-muted line-through"
            >
              {{ durationToText(replaced[level.key]) }}
            </span>
          </span>
          <input
            v-model="text[level.key]"
            type="text"
            class="input mono"
            :placeholder="level.key === 'realisticS' ? '1:38:00' : ''"
          />
          <span class="text-[11.5px] text-text-muted">{{ level.hint }}</span>
        </label>
      </template>

      <div v-else class="col-span-3 flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Référence à battre</span>
        <span class="mono text-[15px]">{{ formatDuration(recordS) }}</span>
        <span class="text-[11.5px] text-text-muted">
          Ton meilleur résultat représentatif sur la distance. La confiance devient la probabilité
          de faire mieux.
        </span>
      </div>
    </div>

    <div class="flex items-baseline gap-3">
      <button
        v-if="mode === 'temps'"
        type="button"
        class="text-[13px] text-accent underline decoration-dotted underline-offset-2"
        :disabled="proposed === null"
        :class="proposed === null && 'cursor-not-allowed opacity-50 no-underline'"
        @click="proposeFromProjection"
      >
        Proposer depuis ma projection
      </button>
      <span v-if="recordS === null" class="text-[12px] text-text-muted">
        « Battre mon record » attend un résultat représentatif sur cette distance : tu n'en as pas
        encore.
      </span>
      <span v-if="misordered" class="text-[12px] text-warn">
        Ambition, réaliste et plancher vont du plus rapide au plus lent.
      </span>
    </div>
  </div>
</template>
