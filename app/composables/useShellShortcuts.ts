/**
 * Raccourcis de la coque : ⌘K / Ctrl+K ouvre l'Imprévu, Échap ferme la couche du dessus.
 */
export function useShellShortcuts() {
  const ui = useUiStore()

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      ui.openPanel('imprevu')
      return
    }
    if (event.key === 'Escape') {
      ui.closeTopLayer()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
