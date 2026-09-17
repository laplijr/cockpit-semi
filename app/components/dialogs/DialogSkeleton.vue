<script setup lang="ts">
import type { ModalId } from '~/stores/ui'

/**
 * Le corps d'un dialog pendant sa requête (§ 8). Le titre, lui, est connu dès
 * l'ouverture : il s'affiche tout de suite, au-dessus de ce squelette.
 */
const props = defineProps<{ modal: ModalId }>()

const SHAPES: Record<ModalId, { columns: number; tiles: number; lines: number }> = {
  seance: { columns: 3, tiles: 6, lines: 3 },
  course: { columns: 3, tiles: 6, lines: 2 },
  cadran: { columns: 2, tiles: 4, lines: 3 },
  proposition: { columns: 2, tiles: 2, lines: 1 },
  exercice: { columns: 2, tiles: 3, lines: 2 },
  bloc: { columns: 2, tiles: 4, lines: 2 },
  'nouvelle-course': { columns: 2, tiles: 2, lines: 3 },
}

const shape = computed(() => SHAPES[props.modal])
</script>

<template>
  <div class="flex flex-col gap-4" aria-busy="true">
    <div class="flex items-baseline gap-3">
      <UiSkeleton :height="24" width="280px" />
      <UiSkeleton width="160px" />
    </div>

    <div
      class="grid gap-4"
      :style="{ gridTemplateColumns: `repeat(${shape.columns}, minmax(0, 1fr))` }"
    >
      <div v-for="tile in shape.tiles" :key="tile" class="tile bg-surface-inset">
        <UiSkeleton :height="15" width="60%" />
        <UiSkeleton :height="20" width="80%" />
      </div>
    </div>

    <UiSkeleton v-for="line in shape.lines" :key="line" :height="18" />
  </div>
</template>
