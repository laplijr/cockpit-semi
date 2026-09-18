<script setup lang="ts">
defineProps<{ phase: string }>()
</script>

<template>
  <div class="tile border-dashed">
    <div class="flex items-center gap-2">
      <UiAppIcon name="warn" class="text-warn" />
      <span class="label">Livré en {{ phase }}</span>
    </div>
    <p class="text-[13px] text-text-dim"><slot /></p>
  </div>
</template>
