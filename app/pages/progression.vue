<script setup lang="ts">
import type { GlossaryTerm } from '~/utils/glossary'

const { data } = await useFetch('/api/progression')

const VDOT_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Origine' },
  { label: 'VDOT', term: 'vdot' },
  { label: 'Projection semi', term: 'projection' },
]

const KEY_SESSION_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Date' },
  { label: 'Séance', term: 'seanceCle' },
  { label: 'Distance' },
  { label: 'RPE prévu', term: 'rpe' },
  { label: 'RPE réel' },
  { label: 'Statut' },
]

const ORIGIN_LABELS: Record<string, string> = {
  course: 'Course',
  test: 'Test 20′',
  import_initial: 'Import',
}

/** Échelle verticale des barres de volume, en pourcentage du maximum. */
const maxVolume = computed(() =>
  Math.max(1, ...(data.value?.weeks ?? []).map((week) => week.targetRunM)),
)

const maxLoad = computed(() => Math.max(1, ...(data.value?.weeks ?? []).map((week) => week.loadUa)))

const visibleWeeks = computed(() => (data.value?.weeks ?? []).slice(0, 24))

type ProgressionWeek = NonNullable<typeof data.value>['weeks'][number]
type WeekSummary = NonNullable<ProgressionWeek['summary']>

/** Noms courts : la bulle tient sur trois lignes, pas « Course à pied ». */
const SHORT_SPORT_LABELS: Record<string, string> = {
  course: 'course',
  velo: 'vélo',
  muscu: 'muscu',
  autre: 'autre',
}

function loadBreakdown(summary: WeekSummary): string {
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
  <div class="flex flex-col gap-4">
    <section class="grid grid-cols-3 gap-4">
      <div class="tile">
        <span class="label">Forme mesurée <UiInfoHint term="vdot" /></span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.vdot.at(-1)?.vdot.toFixed(1).replace('.', ',') ?? '—' }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">
          {{ data?.vdot.length ?? 0 }} point{{ (data?.vdot.length ?? 0) > 1 ? 's' : '' }} ·
          {{ data?.vdot.at(-1)?.isFloor ? 'plancher' : 'mesure' }}
        </span>
      </div>

      <div class="tile">
        <span class="label">Adhérence <UiInfoHint term="adherence" /></span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.adherence === null ? '—' : `${data?.adherence} %` }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">séances prévues réalisées</span>
      </div>

      <div class="tile">
        <span class="label">Propositions acceptées</span>
        <span class="display text-[32px] leading-none font-bold">
          {{ data?.acceptanceRate === null ? '—' : `${data?.acceptanceRate} %` }}
        </span>
        <span class="mono text-[11.5px] text-text-muted">parmi celles décidées</span>
      </div>
    </section>

    <div class="tile">
      <span class="label">VDOT et projection sur semi</span>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th v-for="head in VDOT_COLUMNS" :key="head.label" class="label pb-2 text-[10px]">
              {{ head.label }}
              <UiInfoHint v-if="head.term" :term="head.term" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in data?.vdot ?? []" :key="point.date" class="border-t border-line-soft">
            <td class="mono py-[6px]">{{ formatDate(point.date) }}</td>
            <td class="py-[6px]">
              {{ ORIGIN_LABELS[point.origin] ?? point.origin }}
              <span v-if="point.isFloor" class="pill pill-warn ml-1">plancher</span>
            </td>
            <td class="mono py-[6px]">{{ point.vdot.toFixed(1).replace('.', ',') }}</td>
            <td class="mono py-[6px] text-text-dim">{{ formatDuration(point.halfProjectionS) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Volume visé et charge par semaine <UiInfoHint term="ua" /></span>
        <span class="mono text-[11.5px] text-text-muted">24 premières semaines</span>
      </div>
      <!-- L'objet survolé est la semaine, pas la barre : les deux barres
           ouvrent la même bulle, et la semaine s'atteint au clavier. -->
      <div class="flex h-[140px] items-end gap-1">
        <UiHoverBubble
          v-for="week in visibleWeeks"
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
                :style="{ height: `${(week.targetRunM / maxVolume) * 100}px` }"
              />
              <span
                v-if="week.loadUa > 0"
                class="w-full rounded-b-sm bg-ok/70"
                :style="{ height: `${(week.loadUa / maxLoad) * 30}px` }"
              />
            </span>
          </template>

          <span class="flex items-baseline gap-2">
            <span class="label text-[10px]">Semaine {{ week.index }}</span>
            <span class="mono text-[10.5px] text-text-muted">
              {{ formatDate(week.startDate) }} – {{ formatDate(week.endDate) }}
            </span>
          </span>

          <span class="flex flex-wrap items-baseline gap-2 text-[12.5px] text-text-dim">
            {{ PHASE_LABELS[week.phaseType] ?? week.phaseType }}
            <span v-if="week.light" class="pill text-[10px]">allégée</span>
            <span v-if="week.test" class="pill text-[10px]">test</span>
            <span v-if="week.comebackRatio !== null" class="pill text-[10px]">
              reprise {{ Math.round(week.comebackRatio * 100) }} %
            </span>
          </span>

          <span class="mono text-[12.5px]">
            {{ formatDistance(week.targetRunM) }} visés
            <template v-if="week.summary?.actualRunM !== null && week.summary">
              · {{ formatDistance(week.summary.actualRunM) }} courus ({{
                formatSignedDistance(week.summary.runGapM!)
              }})
            </template>
          </span>

          <span
            v-if="week.summary && week.summary.loadUa > 0"
            class="mono text-[12px] text-text-dim"
          >
            {{ week.summary.loadUa }} UA · {{ loadBreakdown(week.summary) }}
          </span>

          <span v-if="week.summary" class="mono text-[12px] text-text-dim">
            {{ week.summary.sessionsDone }} séance{{
              week.summary.sessionsDone > 1 ? 's' : ''
            }}
            faite{{ week.summary.sessionsDone > 1 ? 's' : '' }} sur
            {{ week.summary.sessionsPlanned }}
          </span>
          <span v-else class="text-[12px] text-text-muted"
            >Semaine à venir, rien d'enregistré.</span
          >
        </UiHoverBubble>
      </div>
      <span class="mono text-[11px] text-text-muted">
        Barre haute : volume visé. Barre basse : charge enregistrée, en unités arbitraires.
      </span>
    </div>

    <div class="tile">
      <span class="label">Journal des séances clés</span>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in KEY_SESSION_COLUMNS"
              :key="head.label"
              class="label pb-2 text-[10px]"
            >
              {{ head.label }}
              <UiInfoHint v-if="head.term" :term="head.term" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in data?.keySessions ?? []"
            :key="item.id"
            class="border-t border-line-soft"
          >
            <td class="mono py-[6px]">{{ formatDate(item.date) }}</td>
            <td class="py-[6px]">{{ SESSION_LABELS[item.code] ?? item.code }}</td>
            <td class="mono py-[6px] text-text-dim">{{ formatDistance(item.distanceM) }}</td>
            <td class="mono py-[6px] text-text-muted">{{ item.expectedRpe ?? '—' }}</td>
            <td
              class="mono py-[6px]"
              :class="
                item.rpe !== null && item.expectedRpe !== null && item.rpe > item.expectedRpe
                  ? 'text-warn'
                  : ''
              "
            >
              {{ item.rpe ?? '—' }}
            </td>
            <td class="py-[6px]">
              <span class="pill" :class="item.status === 'faite' ? 'pill-done' : ''">
                {{ item.status }}
              </span>
            </td>
          </tr>
          <tr v-if="(data?.keySessions.length ?? 0) === 0">
            <td colspan="6" class="py-3 text-text-muted">
              Aucune séance clé encore planifiée ou réalisée.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
