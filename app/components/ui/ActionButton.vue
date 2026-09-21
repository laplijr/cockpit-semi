<script setup lang="ts">
import type { IconName } from './AppIcon.vue'

/**
 * Un bouton qui possède son attente (§ 8, P7.3). Il lance l'action au clic,
 * attend sa résolution, et **ignore tout clic pendant ce temps** — c'est le
 * vrai défaut du retrait de séance, pas seulement l'absence de dessin.
 *
 * Il ne rattrape pas l'erreur : elle continue vers l'appelant, qui garde son
 * message. Un bouton ne dit pas ce qui a échoué.
 */
const props = withDefaults(
  defineProps<{
    action?: () => unknown
    /**
     * Attente d'un autre bouton de la même rangée : celui-ci se verrouille
     * sans prétendre travailler — pas d'indicateur, pas d'`aria-busy`.
     */
    pending?: boolean
    /** Icône de tête ; l'indicateur prend sa place pendant l'attente. */
    icon?: IconName
    iconSize?: number
  }>(),
  { action: undefined, pending: false, icon: undefined, iconSize: 16 },
)

/**
 * Deux seuils, parce qu'une attente trop courte est un clignotement. Le
 * premier est celui de la bulle du § 8, déjà réglé pour la même raison. Le
 * verrou du clic, lui, prend immédiatement : il n'attend aucun seuil.
 */
const APPEAR_MS = 120
const MIN_VISIBLE_MS = 300

const running = ref(false)
const showing = ref(false)

let appearTimer: ReturnType<typeof setTimeout> | undefined
let shownAt = 0

const locked = computed(() => running.value || props.pending)

onBeforeUnmount(() => clearTimeout(appearTimer))

async function run(event: MouseEvent) {
  if (!props.action) return

  /**
   * Un bouton de soumission garde son type — sans lui, Entrée dans un champ ne
   * valide plus le formulaire — mais c'est cette action-ci qui part, une seule
   * fois, et non celle du formulaire par-dessus.
   */
  event.preventDefault()
  if (locked.value) return

  running.value = true
  appearTimer = setTimeout(() => {
    showing.value = true
    shownAt = Date.now()
  }, APPEAR_MS)

  try {
    await props.action()
  } finally {
    clearTimeout(appearTimer)
    if (showing.value) {
      const left = MIN_VISIBLE_MS - (Date.now() - shownAt)
      if (left > 0) await new Promise((resolve) => setTimeout(resolve, left))
      showing.value = false
    }
    running.value = false
  }
}
</script>

<template>
  <button
    type="button"
    v-bind="$attrs"
    :aria-busy="running || undefined"
    :aria-disabled="locked || undefined"
    @click="run"
  >
    <!--
      La largeur est réservée dès le repos, avec ou sans icône : un bouton qui
      s'élargit en travaillant décale sa rangée.
    -->
    <span
      class="relative inline-flex shrink-0 items-center justify-center"
      :style="{ width: `${iconSize}px`, height: `${iconSize}px` }"
    >
      <!-- L'icône reste montée : elle peut porter le nom accessible du bouton. -->
      <UiAppIcon v-if="icon" :name="icon" :size="iconSize" :class="showing && 'opacity-0'" />

      <!--
        Un rond figé ne signifie rien : sous `prefers-reduced-motion` il
        disparaît, et l'attente se lit à l'état inactif et à `aria-busy`.
      -->
      <span
        v-if="showing"
        aria-hidden="true"
        class="absolute inset-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:hidden"
      />
    </span>

    <slot />
  </button>
</template>
