<script setup lang="ts">
import { GLOSSARY, type GlossaryTerm } from '~/utils/glossary'

/**
 * Le mot de métier est son propre déclencheur : il n'y a plus d'icône à côté
 * de lui, il s'éclaircit quand la souris entre dans sa zone (§ 8, P6.36).
 */
const props = defineProps<{ term: GlossaryTerm }>()

const entry = computed(() => GLOSSARY[props.term])
</script>

<template>
  <UiHoverBubble :label="`Qu'est-ce que « ${entry.title} » ?`" trigger-class="explicable">
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ entry.title }}</template>
    <span class="text-[12.5px] leading-[1.45] text-text-dim">{{ entry.text }}</span>
  </UiHoverBubble>
</template>
