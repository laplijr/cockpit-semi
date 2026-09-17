<script setup lang="ts">
import type { PlanPhaseRow, PlanWeekRow } from '~/stores/plan'
import { seasonLayout, type SeasonRace } from '~/utils/season-layout'

const props = defineProps<{
  phases: PlanPhaseRow[]
  weeks: PlanWeekRow[]
  races: SeasonRace[]
  today: string
  dated: boolean
  loading?: boolean
}>()

/**
 * La bande du cockpit reste ce qu'elle était : le détail de la saison vit sur
 * la page Courses (§ 9, P5.16). Seule la géométrie est désormais partagée.
 */
const layout = computed(() => seasonLayout({ ...props }))

const target = computed(() => {
  const raceId = layout.value.segments.at(-1)?.raceId
  return props.races.find((race) => race.id === raceId)
})
</script>

<template>
  <div v-if="loading" class="tile" aria-busy="true">
    <div class="flex items-baseline gap-3">
      <span class="label">Cap</span>
      <UiSkeleton width="220px" />
    </div>
    <UiSkeleton variant="block" :height="24" />
    <UiSkeleton width="340px" />
  </div>

  <div v-else-if="layout.segments.length > 0" class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">Cap</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ layout.totalWeeks }} semaines jusqu'à {{ target?.name }}
      </span>
    </div>

    <div class="flex h-6 w-full overflow-hidden rounded-sm">
      <div
        v-for="(segment, index) in layout.segments"
        :key="segment.id"
        class="flex items-center justify-center border-r border-ink text-[10px] whitespace-nowrap"
        :class="
          segment.current
            ? 'bg-accent text-on-accent'
            : index % 2 === 0
              ? 'bg-surface-raised text-text-dim'
              : 'bg-surface-inset text-text-muted'
        "
        :style="{ width: `${segment.sharePct}%` }"
      >
        <span v-if="segment.sharePct > 6">{{ PHASE_LABELS[segment.type] }}</span>
      </div>
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-1">
      <span
        v-for="mark in layout.races"
        :key="mark.race.id"
        class="mono text-[11.5px] text-text-muted"
      >
        {{ mark.race.name }} · {{ formatDate(mark.race.date) }} · J−{{ mark.daysUntil }}
      </span>
    </div>
  </div>
</template>
