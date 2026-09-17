<script setup lang="ts">
withDefaults(defineProps<{ title: string; width?: number }>(), { width: 880 })
const emit = defineEmits<{ close: [] }>()

const dialog = useDialogFocus()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-10">
    <div class="absolute inset-0 bg-black/55" @click="emit('close')" />
    <section
      ref="dialog"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="relative flex max-h-full flex-col gap-4 overflow-y-auto rounded-md border border-line bg-surface p-6"
      :style="{ width: `${width}px` }"
    >
      <div class="flex items-center gap-3">
        <h2 class="heading">{{ title }}</h2>
        <button
          type="button"
          class="ml-auto text-text-dim hover:text-text"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <UiAppIcon name="close" :size="18" />
        </button>
      </div>

      <!-- La fenêtre s'ouvre sur la forme de son corps, jamais sur une boîte
           vide ni après l'attente de la requête (§ 8, P5.20). -->
      <Suspense>
        <slot />
        <template #fallback>
          <slot name="skeleton" />
        </template>
      </Suspense>
    </section>
  </div>
</template>
