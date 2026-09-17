export const PANEL_IDS = ['imprevu', 'pause'] as const
export const MODAL_IDS = [
  'nouvelle-course',
  'seance',
  'cadran',
  'course',
  'exercice',
  'proposition',
  'bloc',
  'itineraires',
] as const

/** Cadrans du cockpit qui ouvrent un détail (§ 8). */
export const DIAL_IDS = ['course-a', 'forme', 'charge', 'vdot'] as const
export type DialId = (typeof DIAL_IDS)[number]

export type PanelId = (typeof PANEL_IDS)[number]
export type ModalId = (typeof MODAL_IDS)[number]

/**
 * Pile d'affichage du cockpit : au plus un panneau latéral et une fenêtre.
 * Échap ferme la couche la plus haute, la fenêtre avant le panneau.
 */
export const useUiStore = defineStore('ui', () => {
  const panel = ref<PanelId | null>(null)
  const modal = ref<ModalId | null>(null)
  /** Cible du panneau ouvert, quand il en vise une (la séance d'un retour). */
  const panelTargetId = ref<number | null>(null)
  /** Cible de la fenêtre ouverte : l'identifiant d'une séance, d'une course… */
  const modalTargetId = ref<number | null>(null)
  /** Cadran visé quand la fenêtre ouverte est un détail de cadran. */
  const modalDial = ref<DialId | null>(null)
  /** Exercice visé : la bibliothèque muscu les identifie par un code, pas un entier. */
  const modalExerciseId = ref<string | null>(null)

  function openPanel(id: PanelId, targetId: number | null = null) {
    panel.value = id
    panelTargetId.value = targetId
  }

  function closePanel() {
    panel.value = null
    panelTargetId.value = null
  }

  function openModal(id: ModalId, targetId: number | null = null) {
    modal.value = id
    modalTargetId.value = targetId
    modalDial.value = null
    modalExerciseId.value = null
  }

  function openExercise(exerciseId: string) {
    modal.value = 'exercice'
    modalTargetId.value = null
    modalDial.value = null
    modalExerciseId.value = exerciseId
  }

  /** Les cadrans n'ont pas d'identifiant en base : ils se visent par leur nom. */
  function openDial(dial: DialId) {
    modal.value = 'cadran'
    modalTargetId.value = null
    modalDial.value = dial
    modalExerciseId.value = null
  }

  function closeModal() {
    modal.value = null
    modalTargetId.value = null
    modalDial.value = null
    modalExerciseId.value = null
  }

  function closeTopLayer() {
    if (modal.value) {
      closeModal()
      return
    }
    closePanel()
  }

  return {
    panel,
    panelTargetId,
    modal,
    modalTargetId,
    modalDial,
    modalExerciseId,
    openPanel,
    closePanel,
    openModal,
    openDial,
    openExercise,
    closeModal,
    closeTopLayer,
  }
})
