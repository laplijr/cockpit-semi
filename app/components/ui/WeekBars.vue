<script setup lang="ts">
import { Sport } from '~~/server/domain/shared/sport'

/** Une semaine telle que `/api/progression` la rend, résumé compris (P5.14). */
export interface WeekBar {
  index: number
  startDate: string
  endDate: string
  phaseType: string
  targetRunM: number
  light: boolean
  test: boolean
  comebackRatio: number | null
  loadUa: number
  summary?: {
    targetRunM: number
    actualRunM: number | null
    runGapM: number | null
    loadUa: number
    loadBySport: Record<string, number>
    sessionsPlanned: number
    sessionsDone: number
    light: boolean
    test: boolean
    comeback: boolean
  }
}

const props = withDefaults(
  defineProps<{
    weeks: WeekBar[]
    /** Hauteur de la barre de volume la plus haute, en pixels. */
    volumeHeight?: number
    /** Hauteur de la barre de charge la plus haute, en pixels. */
    loadHeight?: number
    gap?: string
    /** Ce que disent les deux étages. Sans elle, le tracé se lit seul (la frise). */
    legend?: { volume: string; load: string }
  }>(),
  { volumeHeight: 100, loadHeight: 30, gap: 'gap-1', legend: undefined },
)

const maxVolume = computed(() => Math.max(1, ...props.weeks.map((week) => week.targetRunM)))
const maxLoad = computed(() => Math.max(1, ...props.weeks.map((week) => week.loadUa)))

/** Noms courts : la bulle tient sur trois lignes, pas « Course à pied ». */
const SHORT_SPORT_LABELS: Record<string, string> = {
  [Sport.Running]: 'course',
  [Sport.Cycling]: 'vélo',
  [Sport.Strength]: 'muscu',
  [Sport.Other]: 'autre',
}

function loadBreakdown(summary: NonNullable<WeekBar['summary']>): string {
  return Object.entries(summary.loadBySport)
    .filter(([, ua]) => ua > 0)
    .map(([sport, ua]) => `${SHORT_SPORT_LABELS[sport] ?? sport} ${ua}`)
    .join(' · ')
}

function formatSignedDistance(meters: number): string {
  return `${meters > 0 ? '+' : '−'}${formatDistance(Math.abs(meters))}`
}
</script>

<template>
  <div class="flex items-end gap-2">
    <!-- La légende est l'axe du tracé, pas un paragraphe sous la tuile : chaque
         mot tient contre l'étage qu'il nomme, dans la couleur de sa barre
         (§ 8, P6.35). -->
    <div
      v-if="legend"
      class="mono flex shrink-0 flex-col text-[10px] text-text-dim"
      :style="{ height: `${volumeHeight + loadHeight + 8}px` }"
    >
      <span class="flex flex-1 items-end gap-[5px]">
        <span class="mb-[3px] size-[8px] shrink-0 rounded-[2px] bg-accent/70" />
        {{ legend.volume }}
      </span>
      <span class="flex items-end gap-[5px]" :style="{ height: `${loadHeight + 8}px` }">
        <span class="mb-[3px] size-[8px] shrink-0 rounded-[2px] bg-ok/70" />
        {{ legend.load }}
      </span>
    </div>

    <!-- L'objet survolé est la semaine, pas la barre : les deux barres ouvrent la
         même bulle, et la semaine s'atteint au clavier (§ 9, P5.14). -->
    <div
      class="flex flex-1 items-end"
      :class="gap"
      :style="{ height: `${volumeHeight + loadHeight + 8}px` }"
    >
      <UiHoverBubble
        v-for="week in weeks"
        :key="week.index"
        class="flex-1"
        :label="`Semaine ${week.index}`"
        :width="300"
        trigger-class="w-full items-end"
      >
        <template #trigger="{ open }">
          <span
            class="flex w-full flex-col justify-end gap-px rounded-sm border p-px"
            :class="open ? 'border-accent' : 'border-transparent'"
          >
            <span
              class="w-full rounded-t-sm"
              :class="week.light ? 'bg-line-strong' : 'bg-accent/70'"
              :style="{ height: `${(week.targetRunM / maxVolume) * volumeHeight}px` }"
            />
            <span
              v-if="week.loadUa > 0"
              class="w-full rounded-b-sm bg-ok/70"
              :style="{ height: `${(week.loadUa / maxLoad) * loadHeight}px` }"
            />
          </span>
        </template>

        <span class="flex items-baseline gap-2">
          <span class="label text-[10px]">Semaine {{ week.index }}</span>
          <span class="mono text-[10.5px] text-text-dim">
            {{ formatDate(week.startDate) }} – {{ formatDate(week.endDate) }}
          </span>
        </span>

        <span class="flex flex-wrap items-baseline gap-2 text-[12.5px] text-text-dim">
          {{ PHASE_LABELS[week.phaseType] ?? week.phaseType }}
          <span v-if="week.light" class="pill text-[10px]">allégée, barre en gris</span>
          <span v-if="week.test" class="pill text-[10px]">test</span>
          <span v-if="week.comebackRatio !== null" class="pill text-[10px]">
            reprise {{ Math.round(week.comebackRatio * 100) }} %
          </span>
        </span>

        <!-- La pastille reprend la couleur exacte de la barre : la bulle se lit
           sans légende à côté du graphe. -->
        <span class="mono flex items-start gap-2 text-[12.5px]">
          <span
            class="mt-[4px] size-[9px] shrink-0 rounded-[2px]"
            :class="week.light ? 'bg-line-strong' : 'bg-accent/70'"
          />
          <span>
            {{ formatDistance(week.targetRunM) }} visés
            <template v-if="week.summary?.actualRunM !== null && week.summary">
              · {{ formatDistance(week.summary.actualRunM) }} courus ({{
                formatSignedDistance(week.summary.runGapM!)
              }})
            </template>
          </span>
        </span>

        <span
          v-if="week.summary && week.summary.loadUa > 0"
          class="mono flex items-start gap-2 text-[12px] text-text-dim"
        >
          <span class="mt-[4px] size-[9px] shrink-0 rounded-[2px] bg-ok/70" />
          <span>{{ week.summary.loadUa }} UA · {{ loadBreakdown(week.summary) }}</span>
        </span>

        <span v-if="week.summary" class="mono text-[12px] text-text-dim">
          {{ week.summary.sessionsDone }} séance{{
            week.summary.sessionsDone > 1 ? 's' : ''
          }}
          faite{{ week.summary.sessionsDone > 1 ? 's' : '' }}
          sur
          {{ week.summary.sessionsPlanned }}
        </span>
        <span v-else class="text-[12px] text-text-dim">Semaine à venir, rien d'enregistré.</span>
      </UiHoverBubble>
    </div>
  </div>
</template>
