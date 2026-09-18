<script setup lang="ts">
/**
 * Une note de séance ou d'exercice, au survol et au focus (§ 8, P6.35). Même
 * bulle que le glossaire, mais le texte vient de la bibliothèque et non d'une
 * notion : trois sites d'appel — la fiche vélo, la fiche renfo, l'exercice.
 */
defineProps<{ title: string; text: string }>()
</script>

<template>
  <UiHoverBubble :label="`À propos de « ${title} »`" trigger-class="text-icon hover:text-text-dim">
    <template #trigger>
      <UiAppIcon name="pen" :size="13" />
    </template>

    <span class="label text-[10px]">{{ title }}</span>
    <span class="text-[12.5px] leading-[1.45] text-text-dim">{{ text }}</span>
  </UiHoverBubble>
</template>
