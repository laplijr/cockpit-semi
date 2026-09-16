<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()

const STUBS = {
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
  propositions: {
    title: 'Propositions',
    subtitle: 'règles R1 – R8',
    phase: 'P3',
    body: 'Chaque proposition affiche sa règle, la valeur actuelle barrée et la valeur proposée. Rien n’est appliqué sans ta décision.',
  },
} as const

const session = computed(
  () => plan.plan?.sessions.find((item) => item.id === ui.panelTargetId) ?? null,
)

async function onSaved() {
  await plan.load()
  ui.closePanel()
}
</script>

<template>
  <Teleport to="body">
    <ShellSidePanel
      v-if="ui.panel === 'retour' && session"
      title="Retour de séance"
      :subtitle="`${SESSION_LABELS[session.code] ?? session.code} · ${formatDate(session.date)}`"
      @close="ui.closePanel()"
    >
      <FeedbackFeedbackForm
        :session="session"
        :watch-zones="plan.pause?.watchZones ?? plan.lastWatchZones"
        @saved="onSaved"
      />
    </ShellSidePanel>

    <ShellSidePanel
      v-else-if="ui.panel && ui.panel !== 'retour'"
      :title="STUBS[ui.panel].title"
      :subtitle="STUBS[ui.panel].subtitle"
      @close="ui.closePanel()"
    >
      <UiPhaseStub :phase="STUBS[ui.panel].phase">{{ STUBS[ui.panel].body }}</UiPhaseStub>
    </ShellSidePanel>
  </Teleport>
</template>
