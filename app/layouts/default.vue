<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()

/**
 * La barre du haut affiche la date et la semaine sur toutes les pages, pas
 * seulement celles qui chargent le plan pour leur propre contenu.
 */
/**
 * Le plan ne bloque plus la coque : elle se peint tout de suite et les tuiles
 * qui l'attendent portent leur squelette (§ 8). Les pages qui n'ont rien à
 * montrer sans lui — Semaine, Courses — l'attendent, elles, dans leur setup.
 */
const circleUnread = useCircleUnread()
/**
 * Le badge des décisions est porté par la coque : chargé par les seules pages
 * qui les affichent, il manquait à une session ouverte sur Semaine (P19).
 */
const proposals = usePropositionsStore()

onMounted(() => {
  plan.ensureLoaded()
  circleUnread.refresh()
  proposals.load()
})

useShellShortcuts()

const layerOpen = computed(() => Boolean(ui.panel || ui.modal))

/*
 * `overflow: hidden` empêche le doigt de faire défiler la page sous une
 * feuille, pas le navigateur. Au téléphone, le clavier qui s'ouvre sur un champ
 * de la feuille fait défiler le document pour dégager le champ ; en se
 * refermant il laisse la page où il l'a emmenée, et la barre du bas — fixée au
 * bas du document, pas de l'écran — remonte au milieu avec du vide noir sous
 * elle (§ 8, P16). Le corps passe donc en `position: fixed` à la position du
 * moment : il n'a plus de course de défilement, donc plus rien à emmener, et on
 * le rend à sa place en fermant.
 */
let lockedAt = 0

function unlock() {
  const { style } = document.body
  style.position = ''
  style.top = ''
  style.insetInline = ''
  style.overflow = ''
}

watch(layerOpen, (open) => {
  if (open) {
    lockedAt = window.scrollY
    const { style } = document.body
    style.position = 'fixed'
    style.top = `-${lockedAt}px`
    style.insetInline = '0'
    style.overflow = 'hidden'
    return
  }

  unlock()
  window.scrollTo(0, lockedAt)
})

onBeforeUnmount(unlock)
</script>

<template>
  <div class="flex min-h-dvh">
    <!-- `dvh` et non `vh` : sur un navigateur de téléphone, `100vh` est la
         hauteur barres rétractées, donc un document plus haut que ce qu'on voit
         et un vide noir sous la barre du bas (§ 8, P7.4). -->
    <ShellSideBar />
    <div class="flex min-w-0 flex-1 flex-col">
      <ShellTopBar />
      <!-- La barre du bas est fixée : la page lui réserve sa hauteur et la zone sûre. -->
      <main
        class="flex flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(var(--spacing-bottombar)+env(safe-area-inset-bottom)+16px)] lean:px-6 lean:pt-5 lean:pb-7"
      >
        <ShellPageHeader />
        <slot />
      </main>
    </div>
    <ShellBottomBar />
    <ShellPanelHost />
    <ShellModalHost />
    <ShellNotices />
  </div>
</template>
