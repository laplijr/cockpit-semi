<script setup lang="ts">
const props = defineProps<{ proposalId: number }>()
const emit = defineEmits<{ decided: [] }>()

const proposals = usePropositionsStore()
const plan = usePlanStore()

/**
 * Seules les propositions en attente s'ouvrent : l'historique est groupé
 * depuis P7.4 et ne porte plus de ligne à ouvrir. Une décision prise ferme la
 * fenêtre — la proposition quitte la liste, la fenêtre n'a plus de sujet.
 */
const proposal = computed(() => proposals.pending.find((item) => item.id === props.proposalId))
/** Verrou de rangée : celle des deux qui ne travaille pas se verrouille aussi. */
const busy = ref(false)

async function accept() {
  busy.value = true
  try {
    await proposals.applyOne(props.proposalId)
    await plan.load()
    emit('decided')
  } finally {
    busy.value = false
  }
}

async function refuse() {
  busy.value = true
  try {
    await proposals.refuse(props.proposalId)
    emit('decided')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="proposal" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-display-s font-semibold">Proposition {{ proposal.ruleId }}</span>
      <span class="mono text-meta text-text-dim">
        déclenchée par {{ proposal.trigger }} ·
        {{ formatDate(proposal.createdAt.slice(0, 10)) }}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-4 lean:grid-cols-2">
      <div class="tile bg-surface-inset">
        <span class="label text-caption">Ce qui change</span>
        <span class="mono text-copy">
          <span class="text-text-dim line-through">{{ proposal.before }}</span>
          <span class="mx-2 text-text-dim">→</span>{{ proposal.after }}
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-caption">Pourquoi</span>
        <p class="text-body text-text-dim">{{ proposal.explanation }}</p>
      </div>
    </div>

    <!-- Appliquer et refuser sont les deux faces d'une même décision : côte à
         côte au clavier, l'une sous l'autre en pleine cible au pouce. -->
    <div class="grid grid-cols-1 gap-2 lean:flex">
      <UiActionButton class="btn" :pending="busy" :action="accept">Appliquer</UiActionButton>
      <UiActionButton class="btn btn-ghost" :pending="busy" :action="refuse">
        Refuser
      </UiActionButton>
    </div>
  </div>
</template>
