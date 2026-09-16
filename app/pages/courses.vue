<script setup lang="ts">
const ui = useUiStore()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center">
      <button type="button" class="btn ml-auto" @click="ui.openModal('nouvelle-course')">
        Nouvelle course
      </button>
    </div>
    <UiPhaseStub phase="P1">
      Table des courses (nom, date, distance, priorité A/B/C, objectif, statut) et périodisation
      calculée depuis la course A.
    </UiPhaseStub>
  </div>
</template>
