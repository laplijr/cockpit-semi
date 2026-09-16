<script setup lang="ts">
const ui = useUiStore()

const MODALS = {
  'nouvelle-course': {
    title: 'Nouvelle course',
    phase: 'P1 (saisie manuelle) · P5 (recherche automatique)',
    body: 'Recherche automatique de la course à gauche (date, profil, météo, inscriptions, avec statut et sources), formulaire pré-rempli à droite.',
  },
} as const
</script>

<template>
  <Teleport to="body">
    <ShellAppModal v-if="ui.modal" :title="MODALS[ui.modal].title" @close="ui.closeModal()">
      <UiPhaseStub :phase="MODALS[ui.modal].phase">{{ MODALS[ui.modal].body }}</UiPhaseStub>
    </ShellAppModal>
  </Teleport>
</template>
