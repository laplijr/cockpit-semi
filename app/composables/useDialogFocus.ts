/**
 * À l'ouverture d'un panneau ou d'une fenêtre, le focus entre dans le dialogue ;
 * à la fermeture, il revient sur l'élément qui l'a ouvert.
 */
export function useDialogFocus() {
  const dialog = ref<HTMLElement>()
  let opener: HTMLElement | null = null

  onMounted(() => {
    opener = document.activeElement as HTMLElement | null
    dialog.value?.focus()
  })

  onBeforeUnmount(() => opener?.focus())

  return dialog
}
