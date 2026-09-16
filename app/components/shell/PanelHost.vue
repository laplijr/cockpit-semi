<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()
const proposals = usePropositionsStore()

async function onSaved() {
  await plan.load()
  ui.closePanel()
}

/** Un imprévu confirmé produit des propositions : la cloche doit les voir tout de suite. */
async function onUnplannedConfirmed() {
  await Promise.all([plan.load(), proposals.load()])
  ui.closePanel()
}
</script>

<template>
  <Teleport to="body">
    <ShellSidePanel
      v-if="ui.panel === 'imprevu'"
      title="Imprévu"
      subtitle="texte libre → événements structurés"
      @close="ui.closePanel()"
    >
      <UnplannedForm @confirmed="onUnplannedConfirmed" />
    </ShellSidePanel>

    <ShellSidePanel
      v-else-if="ui.panel === 'pause'"
      title="Pause / blessure"
      subtitle="gel du plan et reprise progressive"
      @close="ui.closePanel()"
    >
      <PauseForm @declared="onSaved" />
    </ShellSidePanel>
  </Teleport>
</template>
