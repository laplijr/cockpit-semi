export const PANEL_IDS = ['imprevu', 'pause', 'plus'] as const
export const MODAL_IDS = [
  'nouvelle-course',
  'seance',
  'cadran',
  'course',
  'exercice',
  'seance-muscu',
  'seance-biblio',
  'proposition',
  'bloc',
] as const

/** Cadrans du cockpit qui ouvrent un détail (§ 8). */
export const DIAL_IDS = ['course-a', 'forme', 'charge', 'vdot', 'adherence'] as const
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
  /** Séance de la bibliothèque muscu visée, elle aussi par son code. */
  const modalStrengthCode = ref<string | null>(null)
  /** Séance des bibliothèques course et vélo : son sport et son code. */
  const modalLibrary = ref<{ sport: 'course' | 'velo'; code: string } | null>(null)
  /** Jour visé quand la fenêtre ouverte est un jour de repos, sans séance (P6.4). */
  const modalDate = ref<string | null>(null)

  function openPanel(id: PanelId, targetId: number | null = null) {
    panel.value = id
    panelTargetId.value = targetId
  }

  function closePanel() {
    panel.value = null
    panelTargetId.value = null
  }

  /** Toute ouverture repart d'une cible vide : chaque fenêtre vise à sa façon. */
  function reset() {
    modalTargetId.value = null
    modalDial.value = null
    modalExerciseId.value = null
    modalStrengthCode.value = null
    modalLibrary.value = null
    modalDate.value = null
  }

  function openModal(id: ModalId, targetId: number | null = null) {
    reset()
    modal.value = id
    modalTargetId.value = targetId
  }

  function openExercise(exerciseId: string) {
    reset()
    modal.value = 'exercice'
    modalExerciseId.value = exerciseId
  }

  /** Séance de la bibliothèque muscu : l'index ouvre son détail ici (§ 8, P6.35). */
  function openStrengthSession(code: string) {
    reset()
    modal.value = 'seance-muscu'
    modalStrengthCode.value = code
  }

  /** Fiche des bibliothèques course et vélo : la fiche ouvre son détail. */
  function openLibrarySession(sport: 'course' | 'velo', code: string) {
    reset()
    modal.value = 'seance-biblio'
    modalLibrary.value = { sport, code }
  }

  /** Un jour sans séance n'a rien à ouvrir : il ouvre le détail du jour (P6.4). */
  function openDay(date: string) {
    reset()
    modal.value = 'seance'
    modalDate.value = date
  }

  /** Les cadrans n'ont pas d'identifiant en base : ils se visent par leur nom. */
  function openDial(dial: DialId) {
    reset()
    modal.value = 'cadran'
    modalDial.value = dial
  }

  function closeModal() {
    reset()
    modal.value = null
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
    modalStrengthCode,
    modalLibrary,
    modalDate,
    openPanel,
    closePanel,
    openModal,
    openDial,
    openExercise,
    openStrengthSession,
    openLibrarySession,
    openDay,
    closeModal,
    closeTopLayer,
  }
})
