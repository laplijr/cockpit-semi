<script setup lang="ts">
const proposals = usePropositionsStore()
await proposals.load()

const STATUS_LABELS: Record<string, string> = {
  proposee: 'en attente',
  acceptee: 'acceptée',
  refusee: 'refusée',
  expiree: 'expirée',
}

/** L'historique ne s'arrête jamais de grandir : il se lit dix par dix (§ 8). */
const PER_PAGE = 10
const decided = usePagedList(() => proposals.decided, PER_PAGE)
</script>

<template>
  <div class="flex flex-col gap-4">
    <CockpitDecisionList />

    <div class="tile">
      <span class="label">Historique des décisions</span>

      <p v-if="decided.total === 0" class="text-[13px] text-text-dim">
        Aucune décision prise pour l'instant.
      </p>

      <div
        v-for="item in decided.items"
        :key="item.id"
        class="flex items-baseline gap-3 border-t border-line-soft py-[10px] first:border-t-0"
      >
        <span class="pill">{{ item.ruleId }}</span>
        <span class="mono text-[12.5px] text-text-dim">
          <span class="text-text-dim line-through">{{ item.before }}</span>
          <span class="mx-1 text-text-dim">→</span>{{ item.after }}
        </span>
        <span class="pill ml-auto" :class="item.status === 'acceptee' ? 'pill-done' : ''">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </span>
      </div>

      <UiPager v-model="decided.page" :total="decided.total" :per-page="PER_PAGE" />
    </div>
  </div>
</template>
