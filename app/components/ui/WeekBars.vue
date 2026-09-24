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
    /** Hauteur de la plus haute barre, en pixels. */
    height?: number
    /** Écart d'une semaine à l'autre ; le trio, lui, reste serré. */
    gap?: string
  }>(),
  { height: 100, gap: 'gap-1' },
)

/**
 * Deux unités, deux échelles, jamais comparées (§ 9, P6.39). Les kilomètres se
 * rapportent au plus haut des visés et des courus pris ensemble ; la charge a
 * la sienne. Sans ordonnée pour dire laquelle est laquelle, c'est la barre de
 * charge — plus étroite et plus pâle — qui empêche de lire une hauteur d'une
 * couleur à l'autre.
 */
const maxDistance = computed(() =>
  Math.max(1, ...props.weeks.flatMap((week) => [week.targetRunM, week.summary?.actualRunM ?? 0])),
)

const maxLoad = computed(() => Math.max(1, ...props.weeks.map((week) => week.loadUa)))

const heightOf = (value: number, max: number) => Math.round((value / max) * props.height)

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
  <div class="flex flex-col">
    <div v-if="$slots.header"><slot name="header" /></div>

    <!-- L'objet survolé est la semaine, pas la barre : le trio ouvre la même
         bulle, et la semaine s'atteint au clavier (§ 9, P5.14). Depuis P6.39
         cette bulle est la seule légende de la tuile. -->
    <div class="flex items-end" :class="gap" :style="{ height: `${height + 4}px` }">
      <UiHoverBubble
        v-for="week in weeks"
        :key="week.index"
        class="flex-1"
        :label="`Semaine ${week.index}`"
        size="lg"
        trigger-class="w-full items-end"
      >
        <template #trigger="{ open }">
          <span
            class="flex w-full items-end gap-px rounded-sm border px-px"
            :class="open ? 'border-accent' : 'border-transparent'"
          >
            <!--
              Visé en orange creux, couru en orange plein, charge en vert pâle.
              Les deux places du réalisé restent réservées sur une semaine à
              venir : sinon l'abscisse se déforme à chaque semaine enregistrée.
            -->
            <span
              class="flex-1 rounded-t-[2px] border border-accent/70 bg-accent/15"
              :class="week.light && 'border-dashed'"
              :style="{ height: `${heightOf(week.targetRunM, maxDistance)}px` }"
            />
            <span
              class="flex-1 rounded-t-[2px] bg-accent/70"
              :style="{ height: `${heightOf(week.summary?.actualRunM ?? 0, maxDistance)}px` }"
            />
            <span
              class="w-[4px] rounded-t-[2px] bg-ok/45"
              :style="{ height: `${heightOf(week.loadUa, maxLoad)}px` }"
            />
          </span>
        </template>

        <template #title>
          Semaine {{ week.index }} · {{ formatDate(week.startDate) }} –
          {{ formatDate(week.endDate) }}
        </template>

        <span class="flex flex-wrap items-baseline gap-2 text-meta text-text-dim">
          {{ PHASE_LABELS[week.phaseType] ?? week.phaseType }}
          <span v-if="week.light" class="pill text-caption">allégée</span>
          <span v-if="week.test" class="pill text-caption">test</span>
          <span v-if="week.comebackRatio !== null" class="pill text-caption">
            reprise {{ Math.round(week.comebackRatio * 100) }} %
          </span>
        </span>

        <!-- La pastille reprend la couleur exacte de la barre : c'est la bulle
             qui porte la légende, elle n'est plus un supplément (§ 9, P6.39). -->
        <span class="mono flex items-start gap-2 text-meta">
          <span class="mt-[4px] size-[9px] shrink-0 rounded-[2px] border border-accent/70" />
          <span>{{ formatDistance(week.targetRunM) }} visés</span>
        </span>

        <span
          v-if="week.summary && week.summary.actualRunM !== null"
          class="mono flex items-start gap-2 text-meta"
        >
          <span class="mt-[4px] size-[9px] shrink-0 rounded-[2px] bg-accent/70" />
          <span>
            {{ formatDistance(week.summary.actualRunM) }} courus ({{
              formatSignedDistance(week.summary.runGapM!)
            }})
          </span>
        </span>

        <span
          v-if="week.summary && week.summary.loadUa > 0"
          class="mono flex items-start gap-2 text-meta text-text-dim"
        >
          <span class="mt-[4px] size-[9px] shrink-0 rounded-[2px] bg-ok/45" />
          <span>
            {{ week.summary.loadUa }}
            <UiInfoHint term="ua">UA</UiInfoHint> · {{ loadBreakdown(week.summary) }}
          </span>
        </span>

        <span v-if="week.summary" class="mono text-meta text-text-dim">
          {{ week.summary.sessionsDone }} séance{{
            week.summary.sessionsDone > 1 ? 's' : ''
          }}
          faite{{ week.summary.sessionsDone > 1 ? 's' : '' }} sur
          {{ week.summary.sessionsPlanned }}
        </span>
        <span v-else class="text-meta text-text-dim">Semaine à venir, rien d'enregistré.</span>
      </UiHoverBubble>
    </div>

    <div v-if="$slots.footer"><slot name="footer" /></div>
  </div>
</template>
