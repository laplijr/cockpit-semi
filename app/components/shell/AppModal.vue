<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string; width?: number }>(), { width: 880 })
const emit = defineEmits<{ close: [] }>()

const dialog = useDialogFocus()
const sheet = useSheetDrag(() => emit('close'))

/**
 * La largeur de la fenêtre est une variable et non un style direct : sur
 * téléphone la feuille prend toute la largeur, et une valeur en dur l'y
 * clouerait à 1040 px.
 */
const sizing = computed(() => ({ '--modal-width': `${props.width}px`, ...sheet.style }))
</script>

<template>
  <!--
    Même feuille montante que le panneau sous la rupture (§ 8, P6.8) : le corps
    repasse en `display: contents` au-dessus, et la fenêtre retrouve sa forme
    d'avant — une section défilante d'un seul tenant, centrée dans l'écran.
  -->
  <div class="fixed inset-0 z-50 flex items-end justify-center lean:items-center lean:p-10">
    <div class="absolute inset-0 bg-black/55" @click="emit('close')" />
    <section
      ref="dialog"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :style="sizing"
      class="explicable-zone relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-hidden rounded-t-md border border-line bg-surface p-0 lean:max-h-full lean:w-(--modal-width) lean:overflow-y-auto lean:rounded-md lean:p-6"
    >
      <div
        class="flex touch-none justify-center pt-2 pb-1 lean:hidden"
        @pointerdown="sheet.onPointerDown"
        @pointermove="sheet.onPointerMove"
        @pointerup="sheet.onPointerUp"
        @pointercancel="sheet.onPointerUp"
      >
        <span class="h-1 w-10 rounded-full bg-line-strong" />
      </div>

      <div class="flex items-center gap-3 px-[18px] lean:p-0">
        <h2 class="heading">{{ title }}</h2>
        <button
          type="button"
          class="tap -mr-2 ml-auto inline-flex items-center justify-center text-text-dim hover:text-text lean:mr-0"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <UiAppIcon name="close" :size="18" />
        </button>
      </div>

      <!-- La fenêtre s'ouvre sur la forme de son corps, jamais sur une boîte
           vide ni après l'attente de la requête (§ 8, P5.20). -->
      <div
        class="flex min-h-0 flex-1 flex-col gap-[inherit] overflow-y-auto px-[18px] pb-[18px] lean:contents"
      >
        <Suspense>
          <slot />
          <template #fallback>
            <slot name="skeleton" />
          </template>
        </Suspense>
      </div>
    </section>
  </div>
</template>
