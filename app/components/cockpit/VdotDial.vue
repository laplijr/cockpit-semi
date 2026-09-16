<script setup lang="ts">
const props = defineProps<{ vdot: number | null; isFloor: boolean }>()

const ui = useUiStore()

const label = computed(() => (props.isFloor ? 'Plancher' : 'VDOT'))
</script>

<template>
  <div
    class="tile tile-action"
    role="button"
    :tabindex="0"
    @click="ui.openDial('vdot')"
    @keydown.enter.prevent="ui.openDial('vdot')"
    @keydown.space.prevent="ui.openDial('vdot')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label">{{ label }}</span>
      <span v-if="isFloor" class="pill pill-warn">estimation basse</span>
    </div>

    <span class="display text-[44px] leading-none font-bold">
      {{ vdot === null ? '—' : vdot.toFixed(1).replace('.', ',') }}
    </span>

    <span class="mono text-[11.5px] text-text-muted">
      allures et prochain test dans le détail
    </span>
  </div>
</template>
