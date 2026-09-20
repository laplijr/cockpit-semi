/**
 * Sous la rupture, un panneau latéral et une fenêtre sont la même feuille
 * montante : on la referme en la poussant vers le bas (§ 8, P6.8). Le geste
 * part de la poignée seule — le corps de la feuille garde son défilement.
 */
const CLOSE_PAST_PX = 96

export function useSheetDrag(close: () => void) {
  const offset = ref(0)
  const dragging = ref(false)
  let startY = 0

  function onPointerDown(event: PointerEvent) {
    dragging.value = true
    startY = event.clientY
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging.value) return
    offset.value = Math.max(0, event.clientY - startY)
  }

  function onPointerUp() {
    if (!dragging.value) return
    dragging.value = false
    if (offset.value > CLOSE_PAST_PX) {
      close()
      return
    }
    offset.value = 0
  }

  /** Pendant le geste la feuille suit le doigt ; lâchée trop tôt, elle revient. */
  const style = computed(() => ({
    transform: offset.value === 0 ? undefined : `translateY(${offset.value}px)`,
    transition: dragging.value ? 'none' : 'transform 160ms ease',
  }))

  return reactive({ style, onPointerDown, onPointerMove, onPointerUp })
}
