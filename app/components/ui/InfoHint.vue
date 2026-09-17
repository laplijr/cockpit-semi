<script setup lang="ts">
import { GLOSSARY, type GlossaryTerm } from '~/utils/glossary'

const props = defineProps<{ term: GlossaryTerm }>()

const entry = computed(() => GLOSSARY[props.term])
</script>

<template>
  <UiHoverBubble
    :label="`Qu'est-ce que « ${entry.title} » ?`"
    trigger-class="text-icon hover:text-text-dim"
  >
    <template #trigger>
      <UiAppIcon name="info" :size="14" />
    </template>

    <span class="label text-[10px]">{{ entry.title }}</span>
    <span class="text-[12.5px] leading-[1.45] text-text-dim">{{ entry.text }}</span>
  </UiHoverBubble>
</template>
