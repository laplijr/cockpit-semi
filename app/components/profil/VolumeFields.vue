<script setup lang="ts">
defineProps<{ replaced?: { start: number; peak: number } | null }>()

const start = defineModel<number>('start', { required: true })
const peak = defineModel<number>('peak', { required: true })
</script>

<template>
  <div class="fold-2 grid gap-4">
    <label class="flex flex-col gap-[6px]">
      <span class="label text-caption">
        <UiInfoHint term="volumeDepart">Volume de départ (m / semaine)</UiInfoHint>
        <span v-if="replaced" class="mono text-text-dim line-through">{{ replaced.start }}</span>
      </span>
      <input v-model.number="start" type="number" step="1000" class="input mono" />
    </label>
    <label class="flex flex-col gap-[6px]">
      <span class="label text-caption">
        <UiInfoHint term="pic">Pic (m / semaine)</UiInfoHint>
        <span v-if="replaced" class="mono text-text-dim line-through">{{ replaced.peak }}</span>
      </span>
      <input v-model.number="peak" type="number" step="1000" class="input mono" />
    </label>
  </div>
</template>
