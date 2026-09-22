<script setup lang="ts">
import type { ProposalGroup } from '~~/server/application/group-proposals'

/** Le cockpit borne sa surface de décision ; la page Propositions montre tout. */
const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 0 })

const proposals = usePropositionsStore()
const plan = usePlanStore()
const ui = useUiStore()

const visible = computed(() =>
  props.limit > 0 ? proposals.groups.slice(0, props.limit) : proposals.groups,
)

const hidden = computed(() => proposals.groups.length - visible.value.length)

/**
 * La ligne nomme son sujet : quelle séance, quel jour, et ce qu'on lui fait.
 * Depuis P6.35 ce titre complet passe au survol — la ligne, elle, montre la
 * cible en trois mots et le delta. L'identifiant de règle est celui du moteur,
 * pas celui de la décision.
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

/** La cible en trois mots : quelle séance, quel jour — ou combien, et de quel sport. */
function targetOf(group: ProposalGroup): string {
  const [first] = group.targets

  if (group.targets.length === 0) return EFFECT_TITLES[group.effect] ?? 'Plan'
  if (group.targets.length === 1) {
    return `${SESSION_LABELS[first!.code] ?? first!.code} ${formatDate(first!.date)}`
  }

  const sports = new Set(group.targets.map((target) => target.sport))
  const sport = sports.size === 1 ? ` ${SHORT_SPORT_LABELS[first!.sport] ?? first!.sport}` : ''
  return `${group.targets.length} séances${sport}`
}

/** L'icône du sport visé ; un groupe qui mêle les sports n'en a pas. */
function sportOf(group: ProposalGroup): string | null {
  const sports = new Set(group.targets.map((target) => target.sport))
  return sports.size === 1 ? [...sports][0]! : null
}

async function apply() {
  await proposals.applySelected()
  await plan.load()
}
</script>

<template>
  <!-- Trois lignes : c'est la borne de « À décider », donc sa hauteur pleine. -->
  <div v-if="!proposals.loaded" class="tile" aria-busy="true">
    <div class="flex min-h-[32px] items-center gap-3">
      <span class="label">À décider</span>
    </div>
    <UiSkeleton :height="38" width="56px" />
    <div
      v-for="row in limit || 3"
      :key="row"
      class="flex items-center gap-3 border-t border-line-soft py-[8px] first:border-t-0"
    >
      <UiSkeleton variant="block" :height="14" width="14px" />
      <UiSkeleton :height="19" width="46%" />
      <UiSkeleton :height="18" width="88px" class="ml-auto" />
    </div>
    <UiSkeleton :height="18" width="140px" />
  </div>

  <div v-else class="tile">
    <!-- L'action est en haut à droite et n'apparaît qu'une fois une ligne
         cochée ; la rangée garde sa hauteur pour que la tuile ne bouge pas
         (§ 8, P6.35). -->
    <div class="flex min-h-[32px] items-center gap-3">
      <span class="label">À décider</span>
      <UiActionButton v-if="proposals.selected.length > 0" class="btn ml-auto" :action="apply">
        Appliquer {{ proposals.selected.length }}
      </UiActionButton>
    </div>

    <!-- Le compteur est le chiffre de la tuile : il dit d'un coup combien de
         décisions attendent (§ 8, P6.35). -->
    <span
      class="display text-[38px] leading-none font-bold"
      :class="proposals.pendingCount === 0 && 'text-text-dim'"
    >
      {{ proposals.pendingCount }}
    </span>

    <p v-if="proposals.pendingCount === 0" class="text-[13px] text-text-dim">Rien à décider.</p>

    <!-- Une ligne = une cible en trois mots et son delta. Le titre complet et
         l'identifiant de règle passent au survol. -->
    <div
      v-for="group in visible"
      :key="group.key"
      class="flex items-center gap-3 border-t border-line-soft py-[8px] first:border-t-0"
    >
      <input
        type="checkbox"
        class="tap h-5 w-5 shrink-0 accent-accent lean:h-auto lean:w-auto lean:min-h-0 lean:min-w-0"
        :checked="proposals.selected.includes(group.key)"
        :aria-label="titleOf(group)"
        @change="proposals.toggle(group.key)"
      />
      <button
        type="button"
        class="tap explicable-zone grid min-w-0 flex-1 grid-cols-1 content-center gap-1 text-left wide:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] wide:items-baseline wide:gap-3"
        @click="ui.openModal('proposition', group.ids[0]!)"
      >
        <span class="flex min-w-0 items-baseline gap-2">
          <UiAppIcon
            v-if="sportOf(group)"
            :name="sportStyle(sportOf(group)!).icon"
            :size="14"
            :label="SPORT_LABELS[sportOf(group)!] ?? sportOf(group)!"
            :class="['shrink-0 self-center', sportStyle(sportOf(group)!).tone]"
          />
          <!-- Le titre complet et l'identifiant de règle passent au survol. -->
          <UiHoverBubble :label="titleOf(group)" size="lg" trigger-class="min-w-0">
            <template #trigger>
              <span class="explicable truncate text-[13.5px]">{{ targetOf(group) }}</span>
            </template>
            <template #title>{{ titleOf(group) }}</template>
            <span class="mono text-[11.5px] text-text-dim">{{ group.ruleId }}</span>
          </UiHoverBubble>
        </span>

        <!-- Le delta est un texte du moteur, parfois long : il tronque de son
             côté plutôt que d'écraser la cible (§ 8, P6.35). -->
        <span
          v-if="group.before && group.after"
          class="mono truncate text-[12.5px] wide:text-right"
        >
          <span class="text-text-dim line-through">{{ group.before }}</span>
          <span class="mx-1 text-text-dim">→</span>
          <span>{{ group.after }}</span>
        </span>
        <span v-else class="mono truncate text-[12.5px] text-text-dim wide:text-right">
          {{ group.ids.length }} ajustements
        </span>
      </button>
    </div>

    <NuxtLink
      v-if="hidden > 0"
      to="/propositions"
      class="tap mono inline-flex items-center text-[12px] text-text-dim hover:text-text"
    >
      {{ hidden === 1 ? '+ 1 autre' : `+ ${hidden} autres` }}
    </NuxtLink>
  </div>
</template>
