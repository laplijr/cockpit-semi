<script setup lang="ts">
const ui = useUiStore()

useShellShortcuts()

const layerOpen = computed(() => Boolean(ui.panel || ui.modal))

watch(layerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="flex min-h-screen">
    <ShellSideBar />
    <div class="flex min-w-0 flex-1 flex-col">
      <ShellTopBar />
      <main class="flex flex-1 flex-col gap-4 px-6 pt-5 pb-7">
        <slot />
      </main>
    </div>
    <ShellPanelHost />
    <ShellModalHost />
  </div>
</template>
