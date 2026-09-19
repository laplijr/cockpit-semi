<script setup lang="ts">
/** Même règle que le glossaire : c'est le mot qui porte la note, pas une icône. */
defineProps<{ title: string; text: string }>()
</script>

<template>
  <UiHoverBubble :label="`À propos de « ${title} »`" trigger-class="explicable">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ title }}</template>
    <span class="text-[12.5px] leading-[1.45] text-text-dim">{{ text }}</span>
  </UiHoverBubble>
</template>
