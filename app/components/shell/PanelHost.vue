<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()
const proposals = usePropositionsStore()

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

type StubId = keyof typeof STUBS

const stub = computed(() => (ui.panel && ui.panel in STUBS ? STUBS[ui.panel as StubId] : null))

const session = computed(
  () => plan.plan?.sessions.find((item) => item.id === ui.panelTargetId) ?? null,
)

const proposition = computed(
  () => proposals.pending.find((item) => item.id === ui.panelTargetId) ?? null,
)

async function acceptOne(id: number) {
  await proposals.applyOne(id)
  await plan.load()
  ui.closePanel()
}

async function refuseOne(id: number) {
  await proposals.refuse(id)
  ui.closePanel()
}

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
      <FeedbackForm
        :session="session"
        :watch-zones="plan.pause?.watchZones ?? plan.lastWatchZones"
        @saved="onSaved"
      />
    </ShellSidePanel>

    <ShellSidePanel
      v-else-if="ui.panel === 'proposition' && proposition"
      :title="`Proposition ${proposition.ruleId}`"
      subtitle="règle, valeur actuelle et valeur proposée"
      @close="ui.closePanel()"
    >
      <div class="tile">
        <span class="label text-[10.5px]">Ce qui change</span>
        <span class="mono text-[15px]">
          <span class="text-text-muted line-through">{{ proposition.before }}</span>
          <span class="mx-2 text-text-muted">→</span>{{ proposition.after }}
        </span>
      </div>

      <div class="tile">
        <span class="label text-[10.5px]">Pourquoi</span>
        <p class="text-[13px] text-text-dim">{{ proposition.explanation }}</p>
      </div>

      <div class="tile">
        <span class="label text-[10.5px]">Origine</span>
        <span class="mono text-[12.5px] text-text-muted">
          Règle {{ proposition.ruleId }} · déclenchée par {{ proposition.trigger }} ·
          {{ formatDate(proposition.createdAt.slice(0, 10)) }}
        </span>
      </div>

      <div class="flex gap-2">
        <button type="button" class="btn" @click="acceptOne(proposition.id)">Appliquer</button>
        <button type="button" class="btn btn-ghost" @click="refuseOne(proposition.id)">
          Refuser
        </button>
      </div>
    </ShellSidePanel>

    <ShellSidePanel
      v-else-if="stub"
      :title="stub.title"
      :subtitle="stub.subtitle"
      @close="ui.closePanel()"
    >
      <UiPhaseStub :phase="stub.phase">{{ stub.body }}</UiPhaseStub>
    </ShellSidePanel>
  </Teleport>
</template>
