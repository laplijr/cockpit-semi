<script setup lang="ts">
/**
 * Objectif, projection et écart d'une course. La table les met dans une
 * cellule, la carte du téléphone dans une paire libellé-valeur : deux formes,
 * une seule écriture — « à fixer » n'est pas un état, c'est une action qui
 * attend (§ 9, P5.10).
 */
defineProps<{
  race: {
    id: number
    objectiveToSet: boolean
    objectiveMode: string | null
    objectifS: number | null
    recordS: number | null
    projectionS: number | null
    gapS: number | null
  }
}>()

const ui = useUiStore()
</script>

<template>
  <span class="mono">
    <button
      v-if="race.objectiveToSet"
      type="button"
      class="text-accent underline decoration-dotted underline-offset-2"
      @click.stop="ui.openModal('course', race.id)"
    >
      à fixer
    </button>
    <span v-else class="text-text-dim">
      <template v-if="race.objectiveMode === 'record'">record </template>
      {{ formatDuration(race.objectiveMode === 'record' ? race.recordS : race.objectifS) }}
    </span>
    <span class="mx-1 text-text-dim">→</span>
    {{ formatDuration(race.projectionS) }}
    <span v-if="race.gapS !== null" :class="race.gapS > 0 ? 'text-warn' : 'text-ok'" class="ml-1">
      {{ formatSignedDuration(race.gapS) }}
    </span>
  </span>
</template>
