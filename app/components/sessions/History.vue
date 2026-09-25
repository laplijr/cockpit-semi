<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const { session } = defineProps<{ session: PlanSession }>()

const plan = usePlanStore()

/** Mêmes séances du plan, pour situer celle-ci dans la progression. */
const history = computed(() =>
  (plan.plan?.sessions ?? [])
    .filter((item) => item.code === session.code && item.id !== session.id)
    .filter((item) => item.date <= plan.today)
    .slice(-5)
    .reverse(),
)
</script>

<template>
  <div v-if="history.length > 0" class="tile order-3 bg-surface-inset lean:order-none">
    <span class="label text-caption">Les fois d'avant</span>
    <div
      v-for="item in history"
      :key="item.id"
      class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
    >
      <span class="mono text-meta text-text-dim">{{ formatDate(item.date) }}</span>
      <span class="mono text-meta">
        <template v-if="item.prescription.totalDistanceM > 0">
          {{ formatDistance(item.actualDistanceM ?? item.prescription.totalDistanceM) }}
        </template>
        <template v-else>
          {{ formatMinutes(item.actualDurationMin ?? item.prescription.durationMin) }}
        </template>
      </span>
      <span v-if="item.feedbackRpe" class="pill ml-auto">RPE {{ item.feedbackRpe }}</span>
      <span v-else-if="item.status === 'sautee'" class="pill ml-auto">manquée</span>
    </div>
  </div>
</template>
