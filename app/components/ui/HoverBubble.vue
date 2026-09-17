<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Ce que la bulle explique, lu par un lecteur d'écran sur le déclencheur. */
    label: string
    triggerClass?: string
    width?: number
  }>(),
  { triggerClass: '', width: 264 },
)

/** Marge gardée entre la bulle et le bord de l'écran. */
const MARGIN = 8

const bubbleId = useId()

const open = ref(false)
const placed = ref(false)
const position = ref({ top: 0, left: 0 })
const root = ref<HTMLElement | null>(null)
const bubble = ref<HTMLElement | null>(null)

/**
 * Bornes horizontales de la bulle : la zone principale, pour qu'elle ne passe
 * pas sur la barre latérale (§ 8). Dans un dialog, c'est l'écran qui borne —
 * un dialog est centré, il a de la place des deux côtés.
 */
function horizontalBounds() {
  const inDialog = root.value?.closest('[role="dialog"]') !== null
  const area = inDialog ? undefined : root.value?.closest('main')?.getBoundingClientRect()

  return {
    from: Math.max(MARGIN, area?.left ?? 0),
    to: Math.min(window.innerWidth - MARGIN, area?.right ?? window.innerWidth),
  }
}

/**
 * La bulle est posée sur le `body` en position fixe : un dialog qui défile ou
 * une tuile qui rogne son débordement la coupaient. Elle se centre sur son
 * déclencheur, bascule au-dessus quand elle ne tient pas dessous, et reste
 * dans ses bornes de part et d'autre.
 */
function place() {
  const anchor = root.value?.getBoundingClientRect()
  const box = bubble.value?.getBoundingClientRect()
  if (!anchor || !box) return

  const below = anchor.bottom + MARGIN
  const fitsBelow = below + box.height <= window.innerHeight - MARGIN
  const top = fitsBelow ? below : Math.max(MARGIN, anchor.top - box.height - MARGIN)

  const { from, to } = horizontalBounds()
  const centred = anchor.left + anchor.width / 2 - props.width / 2
  const left = Math.min(Math.max(from, centred), Math.max(from, to - props.width))

  position.value = { top, left }
  placed.value = true
}

async function show() {
  open.value = true
  await nextTick()
  place()
}

function hide() {
  open.value = false
  placed.value = false
}

/** Tant qu'elle est ouverte, la bulle suit son déclencheur. */
watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return
  }
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
})
</script>

<template>
  <!-- Le survol explique, il n'agit pas : aucun clic n'est branché ici. -->
  <span
    ref="root"
    class="relative inline-flex align-middle"
    @mouseenter="show"
    @mouseleave="hide"
    @keydown.esc.stop="hide"
  >
    <button
      type="button"
      class="inline-flex"
      :class="triggerClass"
      :aria-label="label"
      :aria-describedby="open ? bubbleId : undefined"
      :aria-expanded="open"
      @focus="show"
      @blur="hide"
      @click.stop.prevent
      @keydown.enter.stop.prevent
      @keydown.space.stop.prevent
    >
      <slot name="trigger" :open="open" />
    </button>

    <Teleport to="body">
      <span
        v-if="open"
        :id="bubbleId"
        ref="bubble"
        role="tooltip"
        class="pointer-events-none fixed z-60 flex flex-col gap-1 rounded-md border border-line-strong bg-surface-raised px-3 py-[10px] text-left shadow-lg"
        :style="{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${width}px`,
          opacity: placed ? 1 : 0,
        }"
      >
        <slot />
      </span>
    </Teleport>
  </span>
</template>
