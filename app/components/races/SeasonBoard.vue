<script setup lang="ts">
import type { PlanPhaseRow, PlanWeekRow } from '~/stores/plan'
import { seasonLayout, type SeasonRace } from '~/utils/season-layout'

const props = defineProps<{
  phases: PlanPhaseRow[]
  weeks: PlanWeekRow[]
  races: SeasonRace[]
  today: string
  dated: boolean
}>()

const ui = useUiStore()

/** Les résumés de semaine de P5.14 : c'est eux qui portent la charge réalisée. */
const { data: progression } = await useFetch('/api/progression')

const layout = computed(() => seasonLayout({ ...props }))

/** Une barre par semaine, alignée au segment de sa phase : même axe x, sans écart. */
const weekBars = computed(() => progression.value?.weeks ?? [])

/** Le cap : la première course A à venir, celle sur laquelle tout se cale. */
const target = computed(() =>
  [...props.races]
    .filter((race) => race.priority === 'A' && race.date >= props.today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(0),
)

const currentSegment = computed(() => layout.value.segments.find((segment) => segment.current))

/** Semaine n de m dans la phase en cours. */
const weekInPhase = computed(() => {
  const segment = currentSegment.value
  if (!segment) return null
  return {
    index: layout.value.currentWeekIndex - segment.startWeek + 1,
    total: segment.weeks,
  }
})

const nextSwitch = computed(() => {
  const segment = currentSegment.value
  if (!segment) return null
  const next = layout.value.segments.find((item) => item.startWeek === segment.endWeek + 1)
  if (!next) return null
  return { type: next.type, startDate: next.startDate }
})

const nextTest = computed(() =>
  props.weeks.find((week) => week.test && week.endDate >= props.today),
)

/** Une puce de bord se range à l'intérieur de la frise au lieu d'en déborder. */
function pillShift(positionPct: number): string {
  if (positionPct < 10) return 'translateX(0)'
  if (positionPct > 90) return 'translateX(-100%)'
  return 'translateX(-50%)'
}
</script>

<template>
  <div v-if="layout.segments.length > 0" class="tile">
    <!-- Quatre informations : le cap, la position, la prochaine bascule, la frise (§ 8). -->
    <div class="flex items-baseline gap-3">
      <span class="label">Cap <UiInfoHint term="courseA" /></span>
      <span v-if="target" class="mono text-[11.5px] text-text-dim">
        {{ target.name }} · {{ formatDateWithYear(target.date) }} · J−{{
          daysUntil(target.date, today)
        }}
      </span>
      <span v-else class="mono text-[11.5px] text-text-dim">Aucune course A à venir.</span>
    </div>

    <div class="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-text-dim">
      <span v-if="currentSegment && weekInPhase">
        <span class="text-text-dim">{{ PHASE_LABELS[currentSegment.type] }}</span>
        · semaine {{ weekInPhase.index }} sur {{ weekInPhase.total }} de la phase · semaine
        {{ layout.currentWeekIndex }} sur {{ layout.totalWeeks }} de la saison
      </span>
      <span v-else>Plan en attente de la reprise : les semaines ne sont pas encore datées.</span>

      <span v-if="nextSwitch">
        Bascule en {{ PHASE_LABELS[nextSwitch.type] }}
        <template v-if="nextSwitch.startDate"> le {{ formatDate(nextSwitch.startDate) }}</template>
      </span>
      <span v-if="nextTest">
        Prochain test <UiInfoHint term="test20" /> en semaine {{ nextTest.index }}
      </span>
    </div>

    <!-- Le trait d'aujourd'hui traverse la barre, le ruban et l'axe. -->
    <div class="relative pt-1">
      <div class="flex h-7 w-full overflow-hidden rounded-sm">
        <button
          v-for="(segment, index) in layout.segments"
          :key="segment.id"
          type="button"
          class="flex cursor-pointer items-center justify-center border-r border-ink text-[10.5px] whitespace-nowrap hover:brightness-125"
          :class="
            segment.current
              ? 'bg-accent text-on-accent'
              : index % 2 === 0
                ? 'bg-surface-raised text-text-dim'
                : 'bg-surface-inset text-text-dim'
          "
          :style="{ width: `${segment.sharePct}%` }"
          :aria-label="`${PHASE_LABELS[segment.type] ?? segment.type}, ${segment.weeks} semaines`"
          @click="ui.openModal('bloc', segment.id)"
        >
          <span v-if="segment.sharePct > 5">{{ PHASE_LABELS[segment.type] }}</span>
          <span v-else class="mono">{{ segment.weeks }}</span>
        </button>
      </div>

      <!-- Deuxième étage : la trajectoire des volumes, sur le même axe que les phases. -->
      <div v-if="weekBars.length === layout.totalWeeks" class="relative">
        <UiWeekBars :weeks="weekBars" :volume-height="44" :load-height="14" gap="gap-0" />
        <div class="pointer-events-none absolute inset-0">
          <span
            v-for="mark in layout.races"
            :key="mark.race.id"
            class="absolute inset-y-0 w-px -translate-x-1/2"
            :class="mark.race.priority === 'A' ? 'bg-accent' : 'bg-line-strong'"
            :style="{ left: `${mark.positionPct}%` }"
          />
        </div>
      </div>

      <div v-if="layout.dated" class="relative h-[58px]">
        <template v-for="mark in layout.races" :key="mark.race.id">
          <span
            class="absolute top-0 w-px -translate-x-1/2"
            :class="[
              mark.race.priority === 'A' ? 'bg-accent' : 'bg-line-strong',
              mark.level === 0 ? 'h-[12px]' : 'h-[32px]',
            ]"
            :style="{ left: `${mark.positionPct}%` }"
          />
          <!-- Un clic n'empile jamais deux surfaces : le repère ouvre la course. -->
          <button
            type="button"
            class="pill tile-action absolute text-[10.5px] whitespace-nowrap"
            :class="mark.race.priority === 'A' && 'bg-accent/15 text-accent'"
            :style="{
              left: `${mark.positionPct}%`,
              top: mark.level === 0 ? '14px' : '34px',
              transform: pillShift(mark.positionPct),
            }"
            @click="ui.openModal('course', mark.race.id)"
          >
            {{ mark.race.name }} · J−{{ mark.daysUntil }}
          </button>
        </template>
      </div>

      <div v-if="layout.dated" class="relative h-4 border-t border-line-soft">
        <span
          v-for="tick in layout.ticks"
          :key="tick.label + tick.positionPct"
          class="mono absolute top-0 text-[10px] text-text-dim"
          :style="{ left: `${tick.positionPct}%`, transform: 'translateX(-50%)' }"
        >
          {{ tick.label }}
        </span>
      </div>

      <div
        v-if="layout.todayPct !== null"
        class="pointer-events-none absolute top-1 bottom-4 w-px bg-accent"
        :style="{ left: `${layout.todayPct}%` }"
      />
    </div>
  </div>
</template>
