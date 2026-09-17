<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()

/**
 * La barre du haut affiche la date et la semaine sur toutes les pages, pas
 * seulement celles qui chargent le plan pour leur propre contenu.
 */
/**
 * Le plan ne bloque plus la coque : elle se peint tout de suite et les tuiles
 * qui l'attendent portent leur squelette (§ 8). Les pages qui n'ont rien à
 * montrer sans lui — Semaine, Courses — l'attendent, elles, dans leur setup.
 */
onMounted(() => {
  plan.ensureLoaded()
})

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
