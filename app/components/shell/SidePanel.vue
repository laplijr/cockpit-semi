<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = useDialogFocus()
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end">
    <div class="absolute inset-0 bg-black/45" @click="emit('close')" />
    <section
      ref="dialog"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="explicable-zone relative flex h-full w-[480px] flex-col gap-[14px] overflow-y-auto border-l border-line bg-surface p-6"
    >
      <div class="flex items-start gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="heading">{{ title }}</h2>
          <span v-if="subtitle" class="mono text-[11.5px] text-text-dim">{{ subtitle }}</span>
        </div>
        <button
          type="button"
          class="ml-auto text-text-dim hover:text-text"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <UiAppIcon name="close" :size="18" />
        </button>
      </div>
      <slot />
    </section>
  </div>
</template>
