<script setup lang="ts">
import { GLOSSARY, type GlossaryTerm } from '~/utils/glossary'

const props = defineProps<{ term: GlossaryTerm }>()

const entry = computed(() => GLOSSARY[props.term])
const bubbleId = useId()

const open = ref(false)
const above = ref(false)
const alignEnd = ref(false)
const root = ref<HTMLElement | null>(null)
const bubble = ref<HTMLElement | null>(null)

const BUBBLE_WIDTH = 264

/**
 * La bulle se pose sous le libellé et bascule au-dessus, ou à droite, quand
 * elle sortirait de la zone principale ou de l'écran.
 */
async function show() {
  open.value = true
  await nextTick()

  const anchor = root.value?.getBoundingClientRect()
  const box = bubble.value?.getBoundingClientRect()
  if (!anchor || !box) return

  const area = root.value?.closest('main, [role="dialog"]')?.getBoundingClientRect()
  const bottom = Math.min(area?.bottom ?? Infinity, window.innerHeight)
  const right = Math.min(area?.right ?? Infinity, window.innerWidth)

  above.value = anchor.bottom + box.height + 8 > bottom
  alignEnd.value = anchor.left + BUBBLE_WIDTH > right
}

function hide() {
  open.value = false
}
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
      class="text-icon hover:text-text-dim"
      :aria-label="`Qu'est-ce que « ${entry.title} » ?`"
      :aria-describedby="open ? bubbleId : undefined"
      :aria-expanded="open"
      @focus="show"
      @blur="hide"
      @click.stop.prevent
      @keydown.enter.stop.prevent
      @keydown.space.stop.prevent
    >
      <UiAppIcon name="info" :size="14" />
    </button>

    <span
      v-if="open"
      :id="bubbleId"
      ref="bubble"
      role="tooltip"
      class="absolute z-40 flex flex-col gap-1 rounded-md border border-line-strong bg-surface-raised px-3 py-[10px] text-left shadow-lg"
      :class="[above ? 'bottom-full mb-2' : 'top-full mt-2', alignEnd ? 'right-0' : 'left-0']"
      :style="{ width: `${BUBBLE_WIDTH}px` }"
    >
      <span class="label text-[10px]">{{ entry.title }}</span>
      <span class="text-[12.5px] leading-[1.45] text-text-dim normal-case">{{ entry.text }}</span>
    </span>
  </span>
</template>
