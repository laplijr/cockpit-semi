<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()
const proposals = usePropositionsStore()

/** Largeur par fenêtre : un détail de séance a besoin de plus qu'une proposition. */
const WIDTHS: Record<string, number> = {
  'nouvelle-course': 1040,
  seance: 1040,
  cadran: 880,
  proposition: 760,
  course: 760,
  exercice: 640,
}

const TITLES: Record<string, string> = {
  'nouvelle-course': 'Nouvelle course',
  seance: 'Séance',
  cadran: 'Détail',
  proposition: 'Proposition',
  course: 'Course',
  exercice: 'Exercice',
}

async function onSessionSaved() {
  await Promise.all([plan.load(), proposals.load()])
  ui.closeModal()
}

async function onDecided() {
  await proposals.load()
  ui.closeModal()
}
</script>

<template>
  <Teleport to="body">
    <ShellAppModal
      v-if="ui.modal"
      :title="TITLES[ui.modal] ?? 'Détail'"
      :width="WIDTHS[ui.modal] ?? 760"
      @close="ui.closeModal()"
    >
      <DialogsSessionDialog
        v-if="ui.modal === 'seance' && ui.modalTargetId"
        :session-id="ui.modalTargetId"
        @saved="onSessionSaved"
      />

      <DialogsDialDialog v-else-if="ui.modal === 'cadran' && ui.modalDial" :dial="ui.modalDial" />

      <DialogsRaceDialog
        v-else-if="ui.modal === 'course' && ui.modalTargetId"
        :race-id="ui.modalTargetId"
      />

      <DialogsExerciseDialog
        v-else-if="ui.modal === 'exercice' && ui.modalExerciseId"
        :exercise-id="ui.modalExerciseId"
      />

      <DialogsProposalDialog
        v-else-if="ui.modal === 'proposition' && ui.modalTargetId"
        :proposal-id="ui.modalTargetId"
        @decided="onDecided"
      />
    </ShellAppModal>
  </Teleport>
</template>
