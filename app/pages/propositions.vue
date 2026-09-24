<script setup lang="ts">
const proposals = usePropositionsStore()

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

      <UiSkeleton v-if="!proposals.loaded" :height="19" width="46%" />
      <p v-else-if="decided.total === 0" class="text-body text-text-dim">
        Aucune décision prise pour l'instant.
      </p>

      <!-- Une ligne = une décision, pas une ligne du moteur : trois séances
           allégées par la même règle le même jour tenaient trois lignes
           indistinguables (§ 9, P7.4). -->
      <div
        v-for="item in decided.items"
        :key="item.key"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line-soft py-[10px] first:border-t-0"
      >
        <span class="pill">{{ item.ruleId }}</span>
        <span v-if="item.before && item.after && item.count > 1" class="mono text-meta">
          {{ item.count }} séances
        </span>
        <span class="mono text-meta text-text-dim">
          {{ formatDate(item.createdAt.slice(0, 10)) }}
        </span>
        <span v-if="item.before && item.after" class="mono text-meta text-text-dim">
          <span class="text-text-dim line-through">{{ item.before }}</span>
          <span class="mx-1 text-text-dim">→</span>{{ item.after }}
        </span>
        <!-- Membres aux valeurs différentes : la décision se dit par son
             nombre, comme dans « À décider ». -->
        <span v-else class="mono text-meta text-text-dim">{{ item.count }} ajustements</span>
        <span class="pill ml-auto" :class="item.status === 'acceptee' ? 'pill-done' : ''">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </span>
      </div>

      <UiPager v-model="decided.page" :total="decided.total" :per-page="PER_PAGE" />
    </div>
  </div>
</template>
