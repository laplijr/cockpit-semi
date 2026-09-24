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
  <div class="flex flex-col gap-2">
    <!-- Sous-grille : libellés, champs et aides s'alignent d'une colonne à
         l'autre, même quand un libellé passe sur deux lignes. En une colonne
         il n'y a plus rien à aligner : elle se dissout (§ 8, P6.8). -->
    <div
      class="flex flex-col gap-[6px] lean:grid lean:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lean:grid-rows-[auto_auto_auto] lean:gap-x-3 lean:gap-y-[6px]"
    >
      <label class="flex flex-col gap-[6px] lean:row-span-3 lean:grid lean:grid-rows-subgrid">
        <span class="label text-caption"><UiInfoHint term="objectif">Objectif</UiInfoHint></span>
        <select v-model="mode" class="input">
          <option value="temps">Chrono cible</option>
          <!-- Un mode indisponible dit pourquoi là où il se choisit, pas en note de bas de page. -->
          <option value="record" :disabled="recordS === null">
            Battre mon record{{ recordS === null ? ' — aucun record sur cette distance' : '' }}
          </option>
        </select>
        <span class="hidden lean:block" />
      </label>

      <template v-if="mode === 'temps'">
        <label
          v-for="level in LEVELS"
          :key="level.key"
          class="flex flex-col gap-[6px] lean:row-span-3 lean:grid lean:grid-rows-subgrid"
        >
          <span class="label text-caption">
            {{ level.label }}
            <span
              v-if="replaced && replaced[level.key] !== null"
              class="mono text-text-dim line-through"
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
          <span class="text-meta text-text-dim">{{ level.hint }}</span>
        </label>

        <!-- Action secondaire, jamais un bouton plein à côté d'« Enregistrer » (§ 8). -->
        <div class="flex flex-col gap-[6px] lean:row-span-3 lean:grid lean:grid-rows-subgrid">
          <span class="hidden lean:block" />
          <button
            type="button"
            class="btn btn-ghost h-9 w-full px-0 lean:w-9"
            :disabled="proposed === null"
            aria-label="Proposer les trois niveaux depuis ma projection"
            @click="proposeFromProjection"
          >
            <UiAppIcon name="wand" :size="16" />
          </button>
          <span class="hidden lean:block" />
        </div>
      </template>

      <div
        v-else
        class="flex flex-col gap-[6px] lean:col-span-4 lean:row-span-3 lean:grid lean:grid-rows-subgrid"
      >
        <span class="label text-caption">Référence à battre</span>
        <span class="mono self-center text-copy">{{ formatDuration(recordS) }}</span>
        <span class="text-meta text-text-dim">
          Ton meilleur résultat représentatif sur la distance. La confiance devient la probabilité
          de faire mieux.
        </span>
      </div>
    </div>

    <p v-if="misordered" class="text-meta text-warn">
      Ambition, réaliste et plancher vont du plus rapide au plus lent.
    </p>
  </div>
</template>
