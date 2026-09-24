<script setup lang="ts">
/** Trois densités, trois largeurs maximales : une bulle courte reste courte. */
const SIZES = { sm: 190, md: 260, lg: 320 } as const

export type BubbleSize = keyof typeof SIZES

const props = withDefaults(
  defineProps<{
    label: string
    triggerClass?: string
    size?: BubbleSize
  }>(),
  { triggerClass: '', size: 'md' },
)

const MARGIN = 8
/** Demi-diagonale d'un carré de 7 px tourné à 45°. */
const ARROW_HALF = 5
const ARROW_EDGE_MARGIN = 12

const OPEN_DELAY_MS = 120
const CLOSE_DELAY_MS = 80
/**
 * Une bulle déjà ouverte ouvre la suivante sans délai, et la fenêtre de grâce
 * couvre le trajet d'un mot au suivant : longer une rangée de libellés ne doit
 * pas faire clignoter quatre dalles (§ 8, P6.36).
 */
const GRACE_MS = 400

/** État partagé par toutes les bulles du module. */
let openCount = 0
let closedAt = 0

const bubbleId = useId()

const open = ref(false)
const placed = ref(false)
const position = ref({ top: 0, left: 0 })
const arrowLeft = ref(0)
const below = ref(true)
const root = ref<HTMLElement | null>(null)
const bubble = ref<HTMLElement | null>(null)

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

const maxWidth = computed(() => SIZES[props.size])

/**
 * Un écran tactile n'a ni survol ni focus : sans ça, les cinquante-six
 * déclencheurs du glossaire seraient muets sur téléphone (§ 8, P6.8). Le mot
 * s'y ouvre au toucher, se ferme au toucher suivant ailleurs, et sans le délai
 * de 120 ms — il n'a de sens que pour une souris qui longe une rangée.
 */
const coarse = ref(false)

onMounted(() => {
  coarse.value = window.matchMedia('(pointer: coarse)').matches
})

function horizontalBounds() {
  const inDialog = root.value?.closest('[role="dialog"]') !== null
  const area = inDialog ? undefined : root.value?.closest('main')?.getBoundingClientRect()

  return {
    from: Math.max(MARGIN, area?.left ?? 0),
    to: Math.min(window.innerWidth - MARGIN, area?.right ?? window.innerWidth),
  }
}

function place() {
  const anchor = root.value?.getBoundingClientRect()
  const box = bubble.value?.getBoundingClientRect()
  if (!anchor || !box) return

  const under = anchor.bottom + MARGIN + ARROW_HALF
  const fitsBelow = under + box.height <= window.innerHeight - MARGIN
  below.value = fitsBelow
  const top = fitsBelow ? under : Math.max(MARGIN, anchor.top - box.height - MARGIN - ARROW_HALF)

  const { from, to } = horizontalBounds()
  const centre = anchor.left + anchor.width / 2
  const left = Math.min(Math.max(from, centre - box.width / 2), Math.max(from, to - box.width))

  /** La flèche suit le centre de l'ancre, sans jamais sortir des coins arrondis. */
  arrowLeft.value = Math.min(
    Math.max(ARROW_EDGE_MARGIN, centre - left),
    Math.max(ARROW_EDGE_MARGIN, box.width - ARROW_EDGE_MARGIN),
  )

  position.value = { top, left }
  placed.value = true
}

async function reveal() {
  if (open.value) return
  open.value = true
  openCount += 1
  await nextTick()
  place()
}

function conceal() {
  if (!open.value) return
  open.value = false
  placed.value = false
  openCount = Math.max(0, openCount - 1)
  closedAt = Date.now()
}

/** Sans bulle ouverte ni fenêtre de grâce, le mot attend d'être vraiment visé. */
function show(immediate = false) {
  clearTimeout(closeTimer)
  if (open.value) return

  const instant = immediate || openCount > 0 || Date.now() - closedAt < GRACE_MS
  if (instant) {
    void reveal()
    return
  }

  clearTimeout(openTimer)
  openTimer = setTimeout(() => void reveal(), OPEN_DELAY_MS)
}

function hide(immediate = false) {
  clearTimeout(openTimer)
  if (immediate) {
    conceal()
    return
  }

  clearTimeout(closeTimer)
  closeTimer = setTimeout(conceal, CLOSE_DELAY_MS)
}

function onPointerDownAnywhere(event: PointerEvent) {
  if (root.value?.contains(event.target as Node)) return
  conceal()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    if (coarse.value) document.addEventListener('pointerdown', onPointerDownAnywhere)
    return
  }
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
  document.removeEventListener('pointerdown', onPointerDownAnywhere)
})

/** Au toucher, le mot bascule : ouvert, il se referme ; fermé, il s'ouvre. */
function onTriggerClick(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  if (!coarse.value) return
  if (open.value) {
    conceal()
    return
  }
  void reveal()
}

onBeforeUnmount(() => {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  if (open.value) conceal()
  window.removeEventListener('scroll', place, true)
  window.removeEventListener('resize', place)
  document.removeEventListener('pointerdown', onPointerDownAnywhere)
})
</script>

<template>
  <!-- Le survol explique, il n'agit pas : aucun clic n'est branché ici. -->
  <span
    ref="root"
    class="relative inline-flex align-baseline"
    @mouseenter="coarse || show()"
    @mouseleave="coarse || hide()"
    @keydown.esc.stop="hide(true)"
  >
    <!--
      Déclencheur en `span` et non en `button` : une tuile qui s'ouvre est
      elle-même un `<button>` depuis P6.35, et le parseur HTML remonte un
      bouton imbriqué hors de son parent — la tuile se démontait. Il sort de
      l'ordre de tabulation depuis P6.36 : cinquante-six arrêts qui n'ouvrent
      qu'une bulle n'ont rien à y faire, le focus du navigateur l'atteint encore.
    -->
    <span
      role="button"
      tabindex="-1"
      class="inline-flex"
      :class="triggerClass"
      :aria-label="label"
      :aria-describedby="open ? bubbleId : undefined"
      @focus="coarse || show(true)"
      @blur="coarse || hide(true)"
      @click="onTriggerClick"
      @keydown.enter.stop.prevent
      @keydown.space.stop.prevent
    >
      <slot name="trigger" :open="open" />
    </span>

    <Teleport to="body">
      <span
        v-if="open"
        :id="bubbleId"
        ref="bubble"
        role="tooltip"
        class="bubble pointer-events-none fixed z-60 flex flex-col gap-1 px-3 py-[10px] text-left"
        :class="placed ? 'bubble-in' : ''"
        :style="{
          top: `${position.top}px`,
          left: `${position.left}px`,
          maxWidth: `${maxWidth}px`,
          opacity: placed ? 1 : 0,
        }"
      >
        <span
          class="bubble-arrow"
          :class="below ? 'bubble-arrow-up' : 'bubble-arrow-down'"
          :style="{
            left: `${arrowLeft}px`,
            [below ? 'top' : 'bottom']: '-4px',
            marginLeft: '-3.5px',
          }"
        />

        <span v-if="$slots.title" class="label text-caption"><slot name="title" /></span>
        <slot />
      </span>
    </Teleport>
  </span>
</template>
