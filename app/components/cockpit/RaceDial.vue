<script setup lang="ts">
interface RaceRow {
  id: number
  name: string
  date: string
  distanceM: number
  priority: string
  objectiveMode: string
  objectifS: number | null
  recordS: number | null
  projectionS: number | null
  projectionLowS: number | null
  projectionHighS: number | null
  projectionIsFloor: boolean | null
  gapS: number | null
  confidencePct: number | null
  objectiveToSet: boolean
}

const props = defineProps<{ race?: RaceRow; today: string }>()

const ui = useUiStore()

const countdown = computed(() => (props.race ? daysUntil(props.race.date, props.today) : null))
</script>

<template>
  <div
    v-if="race"
    class="tile tile-action"
    style="border-color: rgba(242, 162, 58, 0.35)"
    role="button"
    :tabindex="0"
    @click="ui.openDial('course-a')"
    @keydown.enter.prevent="ui.openDial('course-a')"
    @keydown.space.prevent="ui.openDial('course-a')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label"> Course A <UiInfoHint term="courseA" /> · {{ race.name }} </span>
      <span class="mono text-[11.5px] text-text-muted">{{ formatDate(race.date) }}</span>
    </div>

    <span class="display text-[44px] leading-none font-bold text-accent">J−{{ countdown }}</span>

    <!-- Quatre informations : J−, objectif, projection, confiance (§ 8). -->
    <div class="flex items-baseline gap-4">
      <!-- Le niveau réaliste seul : les trois vivent dans le dialog (§ 9, P5.15). -->
      <span class="mono text-[11.5px] text-text-muted">
        <template v-if="race.objectiveToSet">objectif à fixer</template>
        <template v-else-if="race.objectiveMode === 'record'">
          record {{ formatDuration(race.recordS) }}
        </template>
        <template v-else>objectif {{ formatDuration(race.objectifS) }}</template>
      </span>
      <span class="mono text-[11.5px]">{{ formatDuration(race.projectionS) }}</span>
      <span v-if="race.confidencePct !== null" class="pill ml-auto">
        {{ race.confidencePct }} %
      </span>
      <span v-else-if="race.projectionIsFloor" class="pill pill-warn ml-auto">plancher</span>
    </div>

    <!-- L'échelle remplace la ligne grise : la confiance situe le décompte. -->
    <div class="relative h-[10px]">
      <span class="absolute inset-x-0 top-[4px] h-[3px] rounded-sm bg-accent-track" />
      <span
        v-if="race.confidencePct !== null"
        class="absolute top-[4px] h-[3px] rounded-sm bg-accent"
        :style="{ width: `${race.confidencePct}%` }"
      />
    </div>
  </div>

  <div v-else class="tile border-dashed">
    <span class="label">Course A</span>
    <p class="text-[13px] text-text-muted">Aucune course à venir. Ajoute-en une depuis Courses.</p>
  </div>
</template>
