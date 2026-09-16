<script setup lang="ts">
const route = useRoute()
const ui = useUiStore()
const proposals = usePropositionsStore()

const title = computed(() => navItemFor(route.path)?.label ?? 'Cockpit')

const today = computed(() =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date()),
)
</script>

<template>
  <header class="flex h-(--spacing-topbar) items-center gap-4 border-b border-line-soft px-6">
    <div class="flex min-w-[260px] flex-col gap-px">
      <span class="text-sm font-semibold">{{ title }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ today }} · aucun plan actif</span>
    </div>

    <button
      type="button"
      class="flex h-9 max-w-[560px] flex-1 items-center gap-[10px] rounded-md border border-line bg-surface-inset px-3 text-[13px] text-text-muted hover:border-line-strong"
      @click="ui.openPanel('imprevu')"
    >
      <UiAppIcon name="pen" class="text-icon" />
      <span>Un imprévu ? « 1 h de squash », « pas dispo vendredi »…</span>
      <span class="mono ml-auto rounded-sm border border-line px-[5px] py-px text-[11px]">⌘K</span>
    </button>

    <div class="ml-auto flex items-center gap-[10px]">
      <button type="button" class="btn btn-ghost" @click="ui.openPanel('pause')">
        <UiAppIcon name="pause" />
        Pause / blessure
      </button>
      <button
        type="button"
        class="relative inline-flex text-text-dim hover:text-text"
        aria-label="Propositions"
        @click="navigateTo('/propositions')"
      >
        <UiAppIcon name="bell" />
        <span
          v-if="proposals.pendingCount > 0"
          class="badge absolute -top-2 -right-[10px] h-4 min-w-4 text-[10px]"
        >
          {{ proposals.pendingCount }}
        </span>
      </button>
    </div>
  </header>
</template>
