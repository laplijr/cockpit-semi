<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = useDialogFocus()
const sheet = useSheetDrag(() => emit('close'))
</script>

<template>
  <!--
    Sous la rupture, le panneau ancré à droite devient une feuille montante :
    largeur pleine, hauteur au contenu bornée à 92 vh, tête fixe, corps qui
    défile (§ 8, P6.8). Au-dessus, le corps repasse en `display: contents` — il
    sort de la mise en page et le panneau retrouve exactement sa forme d'avant,
    section défilante d'un seul tenant, barre de défilement comprise.
  -->
  <div class="fixed inset-0 z-40 flex items-end justify-center lean:items-stretch lean:justify-end">
    <div class="absolute inset-0 bg-black/45" @click="emit('close')" />
    <section
      ref="dialog"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :style="sheet.style"
      class="explicable-zone relative flex max-h-[92vh] w-full flex-col gap-[14px] overflow-hidden rounded-t-md border-t border-line bg-surface p-0 lean:h-full lean:max-h-none lean:w-[480px] lean:overflow-y-auto lean:rounded-none lean:border-t-0 lean:border-l lean:p-6"
    >
      <!-- Poignée : le seul endroit d'où la feuille se pousse vers le bas. -->
      <div
        class="flex touch-none justify-center pt-2 pb-1 lean:hidden"
        @pointerdown="sheet.onPointerDown"
        @pointermove="sheet.onPointerMove"
        @pointerup="sheet.onPointerUp"
        @pointercancel="sheet.onPointerUp"
      >
        <span class="h-1 w-10 rounded-full bg-line-strong" />
      </div>

      <div class="flex items-start gap-3 px-[18px] lean:p-0">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="heading">{{ title }}</h2>
          <span v-if="subtitle" class="mono text-[11.5px] text-text-dim">{{ subtitle }}</span>
        </div>
        <button
          type="button"
          class="tap -mr-2 ml-auto inline-flex items-center justify-center text-text-dim hover:text-text lean:mr-0"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <UiAppIcon name="close" :size="18" />
        </button>
      </div>

      <div
        class="flex min-h-0 flex-1 flex-col gap-[inherit] overflow-y-auto px-[18px] pb-[18px] lean:contents"
      >
        <slot />
      </div>
    </section>
  </div>
</template>
