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
         l'autre, même quand un libellé passe sur deux lignes. -->
    <div
      class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] grid-rows-[auto_auto_auto] gap-x-3 gap-y-[6px]"
    >
      <label class="row-span-3 grid grid-rows-subgrid gap-y-[6px]">
        <span class="label text-[10.5px]">Objectif <UiInfoHint term="objectif" /></span>
        <select v-model="mode" class="input">
          <option value="temps">Chrono cible</option>
          <!-- Un mode indisponible dit pourquoi là où il se choisit, pas en note de bas de page. -->
          <option value="record" :disabled="recordS === null">
            Battre mon record{{ recordS === null ? ' — aucun record sur cette distance' : '' }}
          </option>
        </select>
        <span />
      </label>

      <template v-if="mode === 'temps'">
        <label
          v-for="level in LEVELS"
          :key="level.key"
          class="row-span-3 grid grid-rows-subgrid gap-y-[6px]"
        >
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

        <!-- Action secondaire, jamais un bouton plein à côté d'« Enregistrer » (§ 8). -->
        <div class="row-span-3 grid grid-rows-subgrid gap-y-[6px]">
          <span />
          <button
            type="button"
            class="btn btn-ghost h-9 w-9 px-0"
            :disabled="proposed === null"
            title="Proposer les trois niveaux depuis ma projection"
            aria-label="Proposer les trois niveaux depuis ma projection"
            @click="proposeFromProjection"
          >
            <UiAppIcon name="wand" :size="16" />
          </button>
          <span />
        </div>
      </template>

      <div v-else class="col-span-4 row-span-3 grid grid-rows-subgrid gap-y-[6px]">
        <span class="label text-[10.5px]">Référence à battre</span>
        <span class="mono self-center text-[15px]">{{ formatDuration(recordS) }}</span>
        <span class="text-[11.5px] text-text-muted">
          Ton meilleur résultat représentatif sur la distance. La confiance devient la probabilité
          de faire mieux.
        </span>
      </div>
    </div>

    <p v-if="misordered" class="text-[12px] text-warn">
      Ambition, réaliste et plancher vont du plus rapide au plus lent.
    </p>
  </div>
</template>
