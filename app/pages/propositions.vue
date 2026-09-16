<script setup lang="ts">
const proposals = usePropositionsStore()
const plan = usePlanStore()
await proposals.load()

const STATUS_LABELS: Record<string, string> = {
  proposee: 'en attente',
  acceptee: 'acceptée',
  refusee: 'refusée',
  expiree: 'expirée',
}

async function apply() {
  await proposals.applySelected()
  await plan.load()
}
</script>

<template>
  <div class="flex max-w-[980px] flex-col gap-4">
    <CockpitDecisionList />

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Historique des décisions</span>
        <span class="mono text-[11.5px] text-text-muted">{{ proposals.decided.length }}</span>
      </div>

      <p v-if="proposals.decided.length === 0" class="text-[13px] text-text-muted">
        Aucune décision prise pour l'instant.
      </p>

      <div
        v-for="item in proposals.decided"
        :key="item.id"
        class="flex items-baseline gap-3 border-t border-line-soft py-[10px] first:border-t-0"
      >
        <span class="pill">{{ item.ruleId }}</span>
        <span class="mono text-[12.5px] text-text-dim">
          <span class="text-text-muted line-through">{{ item.before }}</span>
          <span class="mx-1 text-text-muted">→</span>{{ item.after }}
        </span>
        <span class="pill ml-auto" :class="item.status === 'acceptee' ? 'pill-done' : ''">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </span>
      </div>
    </div>

    <button
      v-if="proposals.selected.length > 0"
      type="button"
      class="btn self-start"
      @click="apply"
    >
      Appliquer {{ proposals.selected.length }}
    </button>
  </div>
</template>
