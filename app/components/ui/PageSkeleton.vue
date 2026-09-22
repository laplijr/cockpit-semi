<script setup lang="ts">
/**
 * L'attente d'une page, à la forme de la page. Une page qui se charge en
 * gardant l'écran précédent ne dit rien du clic ; un cadre vide dit qu'elle
 * arrive et réserve sa place, sans la mise en page en dur qui sauterait
 * quand le contenu se pose (§ 8).
 */
withDefaults(defineProps<{ columns?: number; tiles?: number; lines?: number }>(), {
  columns: 2,
  tiles: 4,
  lines: 2,
})
</script>

<template>
  <div class="flex flex-col gap-4" aria-busy="true">
    <div class="grid gap-4" :class="`fold-${columns}`">
      <div v-for="tile in tiles" :key="tile" class="tile">
        <UiSkeleton :height="15" width="55%" />
        <UiSkeleton :height="22" width="78%" />
        <UiSkeleton :height="15" width="40%" />
      </div>
    </div>

    <UiSkeleton v-for="line in lines" :key="line" :height="18" />
  </div>
</template>
