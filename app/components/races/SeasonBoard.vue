<script setup lang="ts">
import type { PlanPhaseRow, PlanWeekRow } from '~/stores/plan'
import { WINDOW_SPAN, seasonLayout, seasonWindow, type SeasonRace } from '~/utils/season-layout'

const props = defineProps<{
  phases: PlanPhaseRow[]
  weeks: PlanWeekRow[]
  races: SeasonRace[]
  today: string
  dated: boolean
  loading?: boolean
}>()

const ui = useUiStore()
const plan = usePlanStore()

/**
 * Les résumés de semaine de P5.14 : c'est eux qui portent la charge réalisée.
 * La réponse vieillit dès qu'une course est créée — `courses.vue` régénère
 * alors le plan, et l'étage des volumes disparaissait en silence parce que le
 * nombre de semaines ne correspondait plus. Elle se recharge donc avec la
 * version de plan (§ 9, P6.37).
 */
const { data: progression, refresh: refreshProgression } = await useFetch('/api/progression')

watch(
  () => plan.plan?.version.id,
  (id, previous) => {
    if (id !== undefined && previous !== undefined && id !== previous) void refreshProgression()
  },
)

/** La saison entière : elle ne sert plus qu'à la jauge et au trait d'aujourd'hui. */
const layout = computed(() => seasonLayout({ ...props }))

/** Semaine sur laquelle la fenêtre est calée ; nulle tant qu'elle suit aujourd'hui. */
const anchor = ref<number | null>(null)

const view = computed(() => seasonWindow({ ...props, anchor: anchor.value }))

const bars = computed(() => {
  const byIndex = new Map((progression.value?.weeks ?? []).map((week) => [week.index, week]))
  return view.value.columns
    .map((column) => byIndex.get(column.index))
    .filter((week) => week !== undefined)
})

/** Le cap : la première course A à venir, celle sur laquelle tout se cale. */
const target = computed(() =>
  [...props.races]
    .filter((race) => race.priority === 'A' && race.date >= props.today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(0),
)

const WEEK_MS = 7 * 86_400_000

/**
 * Le grand chiffre du cadran : des **semaines**, l'unité dans laquelle se
 * planifie l'entraînement. Le décompte en jours passe au second rang.
 */
const weeksToTarget = computed(() => {
  if (!target.value) return null
  return Math.max(
    0,
    Math.round((Date.parse(target.value.date) - Date.parse(props.today)) / WEEK_MS),
  )
})

/** Sans course A, le cadran bascule sur la phase courante au lieu de se vider. */
const currentSegment = computed(() => view.value.segments.find((segment) => segment.current))

/** Une date sur trois : assez pour se repérer, pas assez pour encombrer. */
const DATE_EVERY = 3

function movedTo(event: PointerEvent) {
  const track = event.currentTarget as HTMLElement
  const share = (event.clientX - track.getBoundingClientRect().left) / track.offsetWidth
  const total = props.weeks.length
  anchor.value = Math.min(total, Math.max(1, Math.round(share * total)))
}

function drag(event: PointerEvent) {
  if (event.buttons === 1) movedTo(event)
}
</script>

<template>
  <!--
    Le titre est connu avant la donnée : il s'affiche tout de suite, et le
    squelette prend la forme du contenu — cadran, douze colonnes, jauge (§ 8).
  -->
  <div v-if="loading" class="tile" aria-busy="true">
    <div class="grid grid-cols-1 gap-4 lean:grid-cols-[210px_1fr] lean:gap-6">
      <div class="flex flex-col gap-2">
        <span class="label">Cap</span>
        <UiSkeleton variant="number" :height="38" />
        <UiSkeleton :height="15" width="150px" />
        <UiSkeleton :height="15" width="60px" />
      </div>
      <div class="flex flex-col gap-1">
        <UiSkeleton variant="block" :height="22" />
        <div class="flex items-end gap-[3px]" style="height: 80px">
          <UiSkeleton
            v-for="column in WINDOW_SPAN"
            :key="column"
            variant="block"
            class="flex-1"
            :height="column % 4 === 0 ? 36 : 64"
          />
        </div>
        <UiSkeleton :height="12" width="100%" />
      </div>
    </div>
    <UiSkeleton variant="block" :height="7" />
  </div>

  <div v-else-if="layout.segments.length > 0" class="tile">
    <!-- Deux informations : le cap, et la saison (§ 8, P6.37). -->
    <div class="grid grid-cols-1 gap-4 lean:grid-cols-[210px_1fr] lean:gap-6">
      <div class="flex flex-col gap-2">
        <span class="label"><UiInfoHint term="courseA">Cap</UiInfoHint></span>

        <template v-if="target">
          <span class="display text-[38px] leading-none font-bold text-accent">
            {{ weeksToTarget }} <span class="text-[17px] font-semibold">sem.</span>
          </span>
          <span class="truncate text-[13px]">{{ target.name }}</span>
          <span class="mono text-[11.5px] whitespace-nowrap text-text-dim">
            {{ formatDateWithYear(target.date) }} · J−{{ daysUntil(target.date, today) }}
          </span>
        </template>

        <template v-else-if="currentSegment">
          <span class="display text-[38px] leading-none font-bold">
            {{ currentSegment.weekInPhase }}
            <span class="text-[17px] font-semibold">/ {{ currentSegment.phaseWeeks }}</span>
          </span>
          <span class="mono text-[11.5px] text-text-dim">
            {{ PHASE_LABELS[currentSegment.type] ?? currentSegment.type }}
          </span>
          <span class="mono text-[11.5px] text-text-dim">aucune course A à venir</span>
        </template>

        <template v-else>
          <span class="display text-[38px] leading-none font-bold text-text-dim">—</span>
          <span class="mono text-[11.5px] text-text-dim">en attente de la reprise</span>
        </template>
      </div>

      <!-- La fenêtre : douze semaines, et rien qui les décrive en prose. C'est
           un objet à axe : sous la rupture elle défile au lieu de se replier. -->
      <UiAxisScroller>
        <div class="flex min-w-[560px] flex-col gap-1 lean:min-w-0">
          <!-- Les mêmes barres que Progression : c'est le même graphe (§ 9, P5.18). -->
          <UiWeekBars
            v-if="bars.length === view.columns.length"
            :weeks="bars"
            :height="64"
            gap="gap-[3px]"
          >
            <!--
            Le bandeau de phases, segmenté sur la fenêtre seule : chaque segment
            a la place d'écrire son nom, et la bascule est la frontière franche
            entre deux colonnes (§ 9, P6.37).
          -->
            <template #header>
              <div class="flex gap-px pb-1">
                <button
                  v-for="segment in view.segments"
                  :key="segment.id"
                  type="button"
                  class="flex h-[22px] items-center justify-center overflow-hidden rounded-[2px] px-2 text-[10.5px] whitespace-nowrap hover:brightness-125"
                  :class="
                    segment.current ? 'bg-accent text-on-accent' : 'bg-surface-raised text-text-dim'
                  "
                  :style="{ width: `${segment.sharePct}%` }"
                  :aria-label="`${PHASE_LABELS[segment.type] ?? segment.type}, ${segment.phaseWeeks} semaines`"
                  @click="ui.openModal('bloc', segment.id)"
                >
                  <span class="truncate">{{ PHASE_LABELS[segment.type] ?? segment.type }}</span>
                  <span v-if="segment.current && segment.weekInPhase" class="mono ml-2 shrink-0">
                    {{ segment.weekInPhase }}/{{ segment.phaseWeeks }}
                  </span>
                </button>
              </div>
            </template>

            <!-- Les repères se posent à leur colonne, plus dans une phrase au-dessus. -->
            <template #footer>
              <div class="flex gap-[3px]">
                <div
                  v-for="(column, index) in view.columns"
                  :key="column.index"
                  class="mono flex min-w-0 flex-1 flex-col items-center pt-1 text-[10px] text-text-dim"
                >
                  <span class="h-[12px] leading-[12px]" :class="column.current && 'text-accent'">
                    S{{ column.index }}
                  </span>

                  <!-- Chaque rangée garde sa hauteur, pleine ou vide : sans quoi
                     la tuile grandirait et rapetisserait au fil du curseur, et
                     une course remonterait à la place d'une date (§ 8). -->
                  <span class="h-[12px] truncate text-[9.5px] leading-[12px]">
                    <template v-if="column.startDate && index % DATE_EVERY === 0">
                      {{ formatDate(column.startDate) }}
                    </template>
                  </span>

                  <span class="flex h-[18px] max-w-full items-center justify-center">
                    <button
                      v-if="column.race"
                      type="button"
                      class="pill tile-action max-w-full text-[10px]"
                      :class="column.race.priority === 'A' && 'bg-accent/15 text-accent'"
                      @click="ui.openModal('course', column.race.id)"
                    >
                      <span class="truncate">{{ column.race.name }}</span>
                    </button>

                    <UiHoverBubble v-else-if="column.test" label="Test 20′ cette semaine" size="sm">
                      <template #trigger>
                        <span class="block size-[6px] rounded-full bg-text-dim" />
                      </template>
                      <span class="text-[12.5px] text-text-dim">Test 20′ cette semaine</span>
                    </UiHoverBubble>
                  </span>
                </div>
              </div>
            </template>
          </UiWeekBars>
        </div>
      </UiAxisScroller>
    </div>

    <!--
      La jauge : la saison entière en sept pixels, sans texte ni axe. Elle porte
      le trait d'aujourd'hui, le cadre de la fenêtre, et elle la commande. Sur
      un plan non daté elle disparaît, comme les dates : la fenêtre garde ses
      numéros de semaine et ses volumes (§ 9, P6.37).
    -->
    <div v-if="layout.dated" class="flex items-center pt-1">
      <div
        class="relative h-[7px] flex-1 cursor-pointer overflow-hidden rounded-sm"
        role="slider"
        :aria-label="`Fenêtre de la saison, à partir de la semaine ${view.firstIndex}`"
        :aria-valuemin="1"
        :aria-valuemax="layout.totalWeeks"
        :aria-valuenow="view.firstIndex"
        :tabindex="0"
        @pointerdown="movedTo"
        @pointermove="drag"
        @keydown.left.prevent="anchor = Math.max(1, view.firstIndex - 1)"
        @keydown.right.prevent="anchor = Math.min(layout.totalWeeks, view.firstIndex + 1)"
      >
        <span class="absolute inset-0 flex">
          <span
            v-for="segment in layout.segments"
            :key="segment.id"
            class="h-full"
            :class="segment.current ? 'bg-accent/45' : 'bg-surface-muted'"
            :style="{ width: `${segment.sharePct}%` }"
          />
        </span>

        <span
          class="absolute inset-y-0 rounded-sm border border-text-dim bg-text/10"
          :style="{ left: `${view.fromPct}%`, width: `${view.widthPct}%` }"
        />

        <span
          v-if="layout.todayPct !== null"
          class="absolute inset-y-0 w-px bg-accent"
          :style="{ left: `${layout.todayPct}%` }"
        />
      </div>
    </div>
  </div>
</template>
