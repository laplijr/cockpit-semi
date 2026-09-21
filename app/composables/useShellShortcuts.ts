/**
 * Raccourcis de la coque : ⌘K / Ctrl+K ouvre l'Imprévu, Échap ferme la couche du dessus.
 */
export function useShellShortcuts() {
  const ui = useUiStore()
  const llm = useLlmAvailable()

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      /** Sans clé, le raccourci n'ouvre rien : la fonction n'existe pas (§ 6). */
      if (llm.value) ui.openPanel('imprevu')
      return
    }
    if (event.key === 'Escape') {
      ui.closeTopLayer()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
