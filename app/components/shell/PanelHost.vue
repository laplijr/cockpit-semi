<script setup lang="ts">
const ui = useUiStore()

const PANELS = {
  imprevu: {
    title: 'Imprévu',
    subtitle: 'texte libre → événements structurés',
    phase: 'P5',
    body: 'Tu décris ce qui s’est passé (« 1 h de squash ce midi, pas dispo vendredi »). Le LLM en extrait des activités et des indisponibilités, le moteur déterministe en tire des propositions.',
  },
  pause: {
    title: 'Pause / blessure',
    subtitle: 'gel du plan et reprise progressive',
    phase: 'P5',
    body: 'Déclarer une blessure, une maladie ou un voyage gèle les semaines couvertes, conserve les activités autorisées et régénère un plan de reprise 60 → 80 → 100 %.',
  },
  retour: {
    title: 'Retour de séance',
    subtitle: 'RPE, sensations, sommeil, douleur',
    phase: 'P2',
    body: 'Le réalisé vient de Strava, il ne reste que le ressenti à saisir : RPE, sensations, heures de sommeil, douleur éventuelle.',
  },
  propositions: {
    title: 'Propositions',
    subtitle: 'règles R1 – R8',
    phase: 'P3',
    body: 'Chaque proposition affiche sa règle, la valeur actuelle barrée et la valeur proposée. Rien n’est appliqué sans ta décision.',
  },
} as const
</script>

<template>
  <Teleport to="body">
    <ShellSidePanel
      v-if="ui.panel"
      :title="PANELS[ui.panel].title"
      :subtitle="PANELS[ui.panel].subtitle"
      @close="ui.closePanel()"
    >
      <UiPhaseStub :phase="PANELS[ui.panel].phase">{{ PANELS[ui.panel].body }}</UiPhaseStub>
    </ShellSidePanel>
  </Teleport>
</template>
