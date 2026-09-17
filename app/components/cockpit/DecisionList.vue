<script setup lang="ts">
import type { ProposalGroup } from '~~/server/application/group-proposals'

/** Le cockpit borne sa surface de décision ; la page Propositions montre tout. */
const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 0 })

const proposals = usePropositionsStore()
const plan = usePlanStore()
const ui = useUiStore()
const applying = ref(false)

const visible = computed(() =>
  props.limit > 0 ? proposals.groups.slice(0, props.limit) : proposals.groups,
)

const hidden = computed(() => proposals.groups.length - visible.value.length)

/**
 * La ligne nomme son sujet : quelle séance, quel jour, et ce qu'on lui fait.
 * L'identifiant de règle est celui du moteur, pas celui de la décision.
 */
function titleOf(group: ProposalGroup): string {
  const standalone = EFFECT_TITLES[group.effect]
  if (standalone && group.targets.length === 0) return standalone

  const action = EFFECT_ACTIONS[group.effect] ?? 'ajustée'
  const [first] = group.targets

  if (group.targets.length === 0) return `Séance ${action}`
  if (group.targets.length === 1) {
    return `${SESSION_LABELS[first!.code] ?? first!.code} de ${formatDate(first!.date)} ${action}`
  }

  const sports = new Set(group.targets.map((target) => target.sport))
  const sport = sports.size === 1 ? ` de ${SHORT_SPORT_LABELS[first!.sport] ?? first!.sport}` : ''
  return `${group.targets.length} séances${sport} ${action}s`
}

async function apply() {
  applying.value = true
  try {
    await proposals.applySelected()
    await plan.load()
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <!-- Trois lignes : c'est la borne de « À décider », donc sa hauteur pleine. -->
  <div v-if="!proposals.loaded" class="tile" aria-busy="true">
    <div class="flex items-baseline gap-3">
      <span class="label">À décider</span>
      <UiSkeleton width="88px" />
    </div>
    <div
      v-for="row in limit || 3"
      :key="row"
      class="flex items-start gap-3 border-t border-line-soft py-[10px] first:border-t-0"
    >
      <UiSkeleton variant="block" :height="14" width="14px" class="mt-1" />
      <div class="flex flex-1 flex-col gap-px">
        <UiSkeleton :height="19" width="70%" />
        <UiSkeleton :height="17" width="45%" />
      </div>
    </div>
    <UiSkeleton :height="18" width="140px" />
  </div>

  <div v-else class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">À décider</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ proposals.pendingCount }} en attente
      </span>
    </div>

    <p v-if="proposals.pendingCount === 0" class="text-[13px] text-text-muted">
      Rien à décider. Les propositions apparaissent après un retour de séance.
    </p>

    <div
      v-for="group in visible"
      :key="group.key"
      class="flex items-start gap-3 border-t border-line-soft py-[10px] first:border-t-0"
    >
      <input
        type="checkbox"
        class="mt-1 accent-accent"
        :checked="proposals.selected.includes(group.key)"
        @change="proposals.toggle(group.key)"
      />
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-col gap-px text-left"
        @click="ui.openModal('proposition', group.ids[0]!)"
      >
        <span class="flex items-baseline gap-2">
          <span class="truncate text-[13.5px]">{{ titleOf(group) }}</span>
          <span class="mono shrink-0 text-[10.5px] text-text-faint">{{ group.ruleId }}</span>
        </span>
        <span v-if="group.before && group.after" class="mono text-[12px]">
          <span class="text-text-muted line-through">{{ group.before }}</span>
          <span class="mx-1 text-text-muted">→</span>
          <span class="text-text-dim">{{ group.after }}</span>
        </span>
        <span v-else class="mono text-[12px] text-text-muted">
          {{ group.ids.length }} ajustements différents
        </span>
      </button>
      <button
        type="button"
        class="shrink-0 text-[12.5px] text-text-muted hover:text-text"
        @click="proposals.refuseGroup(group.key)"
      >
        Refuser
      </button>
    </div>

    <div class="flex items-center gap-4">
      <button
        v-if="proposals.selected.length > 0"
        type="button"
        class="btn"
        :disabled="applying"
        @click="apply"
      >
        Appliquer {{ proposals.selected.length }}
      </button>
      <NuxtLink
        v-if="hidden > 0"
        to="/propositions"
        class="text-[12.5px] text-text-muted hover:text-text"
      >
        {{ hidden === 1 ? "Voir l'autre décision" : `Voir les ${hidden} autres` }}
      </NuxtLink>
    </div>
  </div>
</template>
