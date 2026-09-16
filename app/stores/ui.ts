export const PANEL_IDS = ['imprevu', 'pause', 'retour', 'propositions'] as const
export const MODAL_IDS = ['nouvelle-course'] as const

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

  function openPanel(id: PanelId, targetId: number | null = null) {
    panel.value = id
    panelTargetId.value = targetId
  }

  function closePanel() {
    panel.value = null
    panelTargetId.value = null
  }

  function openModal(id: ModalId) {
    modal.value = id
  }

  function closeModal() {
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
    openPanel,
    closePanel,
    openModal,
    closeModal,
    closeTopLayer,
  }
})
