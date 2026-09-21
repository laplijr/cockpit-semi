<script setup lang="ts">
const ui = useUiStore()
const proposals = usePropositionsStore()
const plan = usePlanStore()
const llm = useLlmAvailable()

const { data: athlete } = await useFetch('/api/athlete')

const menuOpen = ref(false)

const route = useRoute()

const today = computed(() => formatDateWithYear(plan.today))

/** Sans barre latérale, le nom de la page se lit ici : PageHeader se tait. */
const pageTitle = computed(() => navItemFor(route.path)?.label ?? 'Cockpit')

const weekLine = computed(() => {
  if (!plan.loaded || !plan.plan) return null
  const week = plan.currentWeek
  if (!week) return null
  return {
    index: week.index,
    phase: PHASE_LABELS[week.phaseType] ?? week.phaseType,
  }
})

function go(path: string) {
  menuOpen.value = false
  navigateTo(path)
}
</script>

<template>
  <header
    class="flex h-(--spacing-topbar) items-center gap-3 border-b border-line-soft px-4 lean:gap-4 lean:px-6"
  >
    <!-- Téléphone : le titre de la page. Au-delà, l'espace qui centre le champ. -->
    <h1 class="heading min-w-0 flex-1 truncate text-[18px] lean:hidden">{{ pageTitle }}</h1>
    <div class="hidden flex-1 lean:block" />

    <!--
      Sans clé, l'Imprévu n'existe pas : le champ reste à sa place pour ne pas
      déplacer la coque, mais il dit pourquoi il ne répond plus (§ 6).
    -->
    <button
      type="button"
      class="hidden h-9 w-[440px] items-center gap-[10px] rounded-md border border-line bg-surface-inset px-3 text-[13px] text-text-dim hover:border-line-strong disabled:opacity-50 disabled:hover:border-line lean:flex"
      :disabled="!llm"
      @click="ui.openPanel('imprevu')"
    >
      <UiAppIcon name="pen" class="text-icon" />
      <span v-if="llm">Signaler un imprévu ou une indisponibilité</span>
      <span v-else>Imprévu indisponible : la clé du modèle est absente</span>
      <span
        v-if="llm"
        class="mono ml-auto rounded-sm border border-line px-[5px] py-px text-[11px]"
      >
        ⌘K
      </span>
    </button>

    <!--
      Le champ de 440 px et son rappel ⌘K supposent de la place et un clavier :
      sur téléphone l'imprévu se réduit à son icône, et la cloche disparaît —
      elle est devenue un onglet de la barre du bas (§ 8).
    -->
    <button
      type="button"
      class="tap -mr-2 inline-flex items-center justify-center text-text-dim disabled:opacity-50 lean:hidden"
      :aria-label="
        llm
          ? 'Signaler un imprévu ou une indisponibilité'
          : 'Imprévu indisponible : la clé du modèle est absente'
      "
      :disabled="!llm"
      @click="ui.openPanel('imprevu')"
    >
      <UiAppIcon name="pen" :size="18" />
    </button>

    <div class="flex items-center justify-end gap-5 lean:flex-1">
      <button
        type="button"
        class="relative hidden text-text-dim hover:text-text lean:inline-flex"
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

      <span class="hidden h-5 w-px bg-line lean:block" />

      <div class="relative">
        <button
          type="button"
          class="tap flex items-center justify-center rounded-full hover:opacity-80"
          aria-label="Compte"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <img
            v-if="athlete?.avatar || athlete?.firstName"
            :src="athlete.avatar ?? avatarDataUrl(athlete.firstName)"
            alt=""
            class="size-7 rounded-full"
          />
          <span v-else class="size-7 rounded-full bg-surface-muted" />
        </button>

        <template v-if="menuOpen">
          <div class="fixed inset-0 z-40" @click="menuOpen = false" />
          <div
            class="absolute top-full right-0 z-50 mt-1 w-64 rounded-md border border-line bg-surface-raised"
            role="menu"
          >
            <div class="flex flex-col gap-[10px] p-[10px]">
              <div
                class="border border-line border-l-[3px] border-l-accent bg-surface-inset px-[10px] py-2"
              >
                <div class="mono text-[10px] tracking-[0.06em] text-text-dim uppercase">
                  {{ today }}
                </div>
                <template v-if="weekLine">
                  <div class="text-[13px] font-medium">Semaine {{ weekLine.index }}</div>
                  <div class="text-[11px] text-accent">{{ weekLine.phase }}</div>
                </template>
                <div v-else class="text-[11px] text-text-dim">Aucun plan actif</div>
              </div>
            </div>

            <div class="flex flex-col border-t border-line py-1">
              <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 text-left text-[13px] text-text-dim hover:bg-surface-muted hover:text-text"
                role="menuitem"
                @click="go('/profil')"
              >
                <UiAppIcon name="user" class="text-icon" />
                Profil
              </button>
              <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 text-left text-[13px] text-text-dim hover:bg-surface-muted hover:text-text"
                role="menuitem"
                @click="go('/connexions')"
              >
                <UiAppIcon name="plug" class="text-icon" />
                Connexions
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>
