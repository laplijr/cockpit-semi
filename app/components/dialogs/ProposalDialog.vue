<script setup lang="ts">
const props = defineProps<{ proposalId: number }>()
const emit = defineEmits<{ decided: [] }>()

const proposals = usePropositionsStore()
const plan = usePlanStore()

const proposal = computed(() =>
  [...proposals.pending, ...proposals.decided].find((item) => item.id === props.proposalId),
)

const pending = computed(() => proposal.value?.status === 'proposee')
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
      <span class="display text-[22px] font-semibold">Proposition {{ proposal.ruleId }}</span>
      <span class="mono text-[11.5px] text-text-muted">
        déclenchée par {{ proposal.trigger }} ·
        {{ formatDate(proposal.createdAt.slice(0, 10)) }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Ce qui change</span>
        <span class="mono text-[15px]">
          <span class="text-text-muted line-through">{{ proposal.before }}</span>
          <span class="mx-2 text-text-muted">→</span>{{ proposal.after }}
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Pourquoi</span>
        <p class="text-[13px] text-text-dim">{{ proposal.explanation }}</p>
      </div>
    </div>

    <div v-if="pending" class="flex gap-2">
      <button type="button" class="btn" :disabled="busy" @click="accept">Appliquer</button>
      <button type="button" class="btn btn-ghost" :disabled="busy" @click="refuse">Refuser</button>
    </div>
    <p v-else class="text-[13px] text-text-muted">Décision déjà prise : {{ proposal.status }}.</p>
  </div>
</template>
