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

/**
 * Le repère porte le nom de la course et son décompte. Deux courses qui se
 * gênent ne se chevauchent pas : `seasonLayout` monte la seconde d'un niveau
 * (`RACE_COLLISION_PCT`). La frise ne replie sur la liste de libellés que
 * lorsque deux courses tombent à moins de 3 % l'une de l'autre, où même les
 * deux niveaux ne suffisent plus (§ 8, P6.35).
 */
const MIN_GAP_PCT = 3

const crowded = computed(() => {
  const positions = layout.value.races.map((mark) => mark.positionPct).sort((a, b) => a - b)
  return positions.some((value, index) => index > 0 && value - positions[index - 1]! < MIN_GAP_PCT)
})

/** Un repère au ras d'un bord s'aligne dessus au lieu de déborder de la tuile. */
function alignOf(positionPct: number): string {
  if (positionPct < 20) return 'items-start'
  if (positionPct > 80) return 'items-end -translate-x-full'
  return 'items-center -translate-x-1/2'
}

/** Hauteur de la barre de phases : le trait du repère la traverse toujours. */
const BAR_H = 24
const LEVEL_H = 15
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
      <span class="mono text-[11.5px] text-text-dim">
        {{ layout.totalWeeks }} semaines jusqu'à {{ target?.name }}
      </span>
    </div>

    <!-- Les courses sont des repères sur la barre de phases : la liste de
         libellés en dessous disparaît, sauf si deux d'entre elles se gênent
         (§ 8, P6.35). -->
    <UiAxisScroller>
      <div
        class="relative min-w-[900px] lean:min-w-0"
        :class="!crowded && layout.races.length > 0 && 'lean:pt-[30px]'"
      >
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
                  : 'bg-surface-inset text-text-dim'
            "
            :style="{ width: `${segment.sharePct}%` }"
          >
            <span v-if="segment.sharePct > 6">{{ PHASE_LABELS[segment.type] }}</span>
          </div>
        </div>

        <template v-if="!crowded">
          <!--
            Un repère sur la barre demande la place d'un nom : sous la rupture
            il n'y en a pas, et deux courses proches empilaient leurs libellés.
            Le téléphone reçoit donc la forme que la barre prend déjà quand
            deux courses se gênent — la liste en dessous (§ 8, P6.8).
          -->
          <span
            v-for="mark in layout.races"
            :key="mark.race.id"
            class="absolute bottom-0 hidden flex-col gap-px lean:flex"
            :class="alignOf(mark.positionPct)"
            :style="{ left: `${mark.positionPct}%` }"
          >
            <UiHoverBubble :label="`${mark.race.name}, le ${formatDate(mark.race.date)}`" size="sm">
              <template #trigger>
                <span class="mono text-[10px] whitespace-nowrap text-text-dim">
                  {{ mark.race.name }} · J−{{ mark.daysUntil }}
                </span>
              </template>
              <span class="text-[12.5px] text-text-dim">
                {{ mark.race.name }} · {{ formatDate(mark.race.date) }}
              </span>
            </UiHoverBubble>
            <!-- Le trait descend du libellé jusqu'au bas de la barre, quel que
                 soit le niveau où la course a été montée. -->
            <span
              class="w-[2px] bg-text"
              :style="{ height: `${BAR_H + mark.level * LEVEL_H}px` }"
            />
          </span>
        </template>
      </div>
    </UiAxisScroller>

    <div
      v-if="layout.races.length > 0"
      class="flex flex-wrap gap-x-5 gap-y-1"
      :class="!crowded && 'lean:hidden'"
    >
      <span
        v-for="mark in layout.races"
        :key="mark.race.id"
        class="mono text-[11.5px] text-text-dim"
      >
        {{ mark.race.name }} · {{ formatDate(mark.race.date) }} · J−{{ mark.daysUntil }}
      </span>
    </div>
  </div>
</template>
