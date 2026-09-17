<script setup lang="ts">
import { PROFILE_LABELS } from '~~/server/domain/athlete/profile'

const route = useRoute()
const ui = useUiStore()
const proposals = usePropositionsStore()
const plan = usePlanStore()

const { data: athlete } = await useFetch('/api/athlete')

const profileLabel = computed(() =>
  athlete.value?.profile ? (PROFILE_LABELS[athlete.value.profile] ?? null) : null,
)

/** Identité de la barre : âge et profil, quand ils sont renseignés. */
const identity = computed(() =>
  [athlete.value?.age ? `${athlete.value.age} ans` : null, profileLabel.value]
    .filter(Boolean)
    .join(' · '),
)

const title = computed(() => navItemFor(route.path)?.label ?? 'Cockpit')

/** Le plan est chargé par la coque (`app/layouts/default.vue`) avant ce rendu. */
const context = computed(() => {
  if (!plan.loaded) return ''
  const date = formatDateWithYear(plan.today)
  if (!plan.plan) return `${date} · aucun plan actif`
  const week = plan.currentWeek
  if (!week) return date
  return `${date} · semaine ${week.index} · ${PHASE_LABELS[week.phaseType] ?? week.phaseType}`
})
</script>

<template>
  <header class="flex h-(--spacing-topbar) items-center gap-4 border-b border-line-soft px-6">
    <div class="flex min-w-[260px] flex-col gap-px">
      <span class="text-sm font-semibold">{{ title }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ context }}</span>
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

      <button
        type="button"
        class="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 hover:bg-surface-inset"
        @click="navigateTo('/profil')"
      >
        <span class="flex min-w-0 flex-col items-end gap-px">
          <span class="text-[13px] font-semibold">{{ athlete?.firstName ?? 'Profil' }}</span>
          <span v-if="identity" class="mono text-[10.5px] text-text-muted">{{ identity }}</span>
        </span>
        <img
          :src="athlete?.avatar ?? avatarDataUrl(athlete?.firstName)"
          alt=""
          class="size-7 rounded-full"
        />
      </button>
    </div>
  </header>
</template>
