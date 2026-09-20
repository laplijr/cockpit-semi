<script setup lang="ts">
const route = useRoute()
const ui = useUiStore()
const proposals = usePropositionsStore()
</script>

<template>
  <!--
    La boucle quotidienne à un toucher, le reste à deux (§ 8). Fixée en bas :
    c'est le seul endroit de l'écran qu'un pouce atteint sans lâcher le
    téléphone. Elle s'arrête à la rupture, où la souris revient.
  -->
  <nav
    aria-label="Navigation"
    class="fixed inset-x-0 bottom-0 z-30 flex h-[calc(var(--spacing-bottombar)+env(safe-area-inset-bottom))] items-stretch border-t border-line bg-ink-deep pb-[env(safe-area-inset-bottom)] lean:hidden"
  >
    <NuxtLink
      v-for="item in BOTTOM_BAR_ITEMS"
      :key="item.to"
      :to="item.to"
      class="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
      :class="route.path === item.to ? 'text-text' : 'text-text-dim'"
      :aria-current="route.path === item.to ? 'page' : undefined"
    >
      <!-- L'onglet courant se lit sans couleur seule : il porte un trait. -->
      <span
        v-if="route.path === item.to"
        class="absolute inset-x-3 top-0 h-[2px] rounded-b-sm bg-accent"
      />
      <span class="relative inline-flex">
        <UiAppIcon
          :name="item.icon"
          :size="20"
          :class="route.path === item.to ? 'text-accent' : 'text-icon'"
        />
        <span
          v-if="item.to === '/propositions' && proposals.pendingCount > 0"
          class="badge absolute -top-1 -right-[10px] h-4 min-w-4 text-[10px]"
        >
          {{ proposals.pendingCount }}
        </span>
      </span>
      <span class="text-[10.5px]" :class="route.path === item.to && 'font-semibold'">
        {{ item.label }}
      </span>
    </NuxtLink>

    <button
      type="button"
      class="flex flex-1 flex-col items-center justify-center gap-[3px] text-text-dim"
      :aria-expanded="ui.panel === 'plus'"
      @click="ui.openPanel('plus')"
    >
      <UiAppIcon name="more" :size="20" class="text-icon" />
      <span class="text-[10.5px]">Plus</span>
    </button>
  </nav>
</template>
