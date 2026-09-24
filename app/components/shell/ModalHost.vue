<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()
const proposals = usePropositionsStore()

/** Largeur par fenêtre : un détail de séance a besoin de plus qu'une proposition. */
const WIDTHS: Record<string, number> = {
  'nouvelle-course': 1040,
  'course-passee': 560,
  seance: 1040,
  cadran: 880,
  proposition: 760,
  course: 760,
  exercice: 640,
  'seance-muscu': 640,
  'seance-biblio': 880,
  bloc: 880,
  publication: 600,
  calage: 560,
}

const TITLES: Record<string, string> = {
  'nouvelle-course': 'Nouvelle course',
  'course-passee': 'Course déjà courue',
  seance: 'Séance',
  cadran: 'Détail',
  proposition: 'Proposition',
  course: 'Course',
  exercice: 'Exercice',
  'seance-muscu': 'Séance de renforcement',
  'seance-biblio': 'Séance',
  bloc: 'Bloc',
  publication: 'Publication',
  calage: 'Caler',
}

/** Un jour sans séance n'est pas une séance : la fenêtre le dit dans son titre. */
const title = computed(() =>
  ui.modal === 'seance' && !ui.modalTargetId ? 'Jour' : (TITLES[ui.modal ?? ''] ?? 'Détail'),
)

async function onSessionSaved() {
  await Promise.all([plan.load(), proposals.load()])
  ui.closeModal()
}

/** Une course modifiée peut avoir régénéré le plan : tout se recharge. */
async function onRaceChanged() {
  await refreshNuxtData()
  await plan.load()
  ui.closeModal()
}

/** Un commentaire ou un retrait change la semaine affichée derrière la fenêtre. */
async function onPostChanged() {
  await useCircleStore().load()
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
      :title="title"
      :width="WIDTHS[ui.modal] ?? 760"
      @close="ui.closeModal()"
    >
      <template #skeleton>
        <DialogsDialogSkeleton :modal="ui.modal" />
      </template>

      <!-- Une course créée peut avoir régénéré le plan, comme une course modifiée. -->
      <RacesNewRaceWindow v-if="ui.modal === 'nouvelle-course'" @created="onRaceChanged" />

      <!-- L'autre porte : une course qu'on a déjà courue (§ 9, P7.5). -->
      <RacesPastRaceWindow v-else-if="ui.modal === 'course-passee'" @created="onRaceChanged" />

      <DialogsSessionDialog
        v-else-if="ui.modal === 'seance' && (ui.modalTargetId || ui.modalDate)"
        :session-id="ui.modalTargetId"
        :date="ui.modalDate"
        @saved="onSessionSaved"
      />

      <DialogsDialDialog v-else-if="ui.modal === 'cadran' && ui.modalDial" :dial="ui.modalDial" />

      <DialogsRaceDialog
        v-else-if="ui.modal === 'course' && ui.modalTargetId"
        :race-id="ui.modalTargetId"
        @changed="onRaceChanged"
      />

      <DialogsExerciseDialog
        v-else-if="ui.modal === 'exercice' && ui.modalExerciseId"
        :exercise-id="ui.modalExerciseId"
      />

      <DialogsCalibrationDialog
        v-else-if="ui.modal === 'calage' && ui.modalExerciseId"
        :exercise-id="ui.modalExerciseId"
        :session-id="ui.modalTargetId"
      />

      <DialogsStrengthSessionDialog
        v-else-if="ui.modal === 'seance-muscu' && ui.modalStrengthCode"
        :code="ui.modalStrengthCode"
      />

      <DialogsLibrarySessionDialog
        v-else-if="ui.modal === 'seance-biblio' && ui.modalLibrary"
        :sport="ui.modalLibrary.sport"
        :code="ui.modalLibrary.code"
      />

      <DialogsProposalDialog
        v-else-if="ui.modal === 'proposition' && ui.modalTargetId"
        :proposal-id="ui.modalTargetId"
        @decided="onDecided"
      />

      <DialogsBlockDialog
        v-else-if="ui.modal === 'bloc' && ui.modalTargetId"
        :phase-id="ui.modalTargetId"
      />

      <DialogsPostDialog
        v-else-if="ui.modal === 'publication' && ui.modalTargetId"
        :post-id="ui.modalTargetId"
        @changed="onPostChanged"
      />
    </ShellAppModal>
  </Teleport>
</template>
