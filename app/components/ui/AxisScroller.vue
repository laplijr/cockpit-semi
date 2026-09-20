<script setup lang="ts">
/**
 * Un objet à axe ne se replie pas : il défile horizontalement dans sa tuile
 * (§ 8, P6.8). Une frise empilée en colonne n'est plus une frise, une semaine
 * à sept colonnes qui passe à la ligne n'est plus une semaine. Le dégradé de
 * bord ne s'affiche que du côté où il reste vraiment de la matière — sinon il
 * annonce un ailleurs qui n'existe pas. Au-dessus de la rupture, le conteneur
 * est transparent : ni défilement, ni dégradé, ni découpe.
 */
const el = ref<HTMLElement | null>(null)
const more = reactive({ before: false, after: false })

function measure() {
  const node = el.value
  if (!node) return
  const max = node.scrollWidth - node.clientWidth
  more.before = node.scrollLeft > 1
  more.after = node.scrollLeft < max - 1
}

let observer: ResizeObserver | undefined

onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(el.value!)
  /* Le contenu grandit sans que le conteneur bouge : un jour de plus, une
     course posée. C'est sa largeur à lui qui dit s'il reste à voir. */
  if (el.value?.firstElementChild) observer.observe(el.value.firstElementChild)
})

onBeforeUnmount(() => observer?.disconnect())

defineExpose({ el })
</script>

<template>
  <div class="relative min-w-0">
    <div ref="el" class="overflow-x-auto lean:overflow-x-visible" @scroll="measure">
      <slot />
    </div>

    <span
      v-if="more.before"
      class="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-surface lean:hidden"
    />
    <span
      v-if="more.after"
      class="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-surface lean:hidden"
    />
  </div>
</template>
