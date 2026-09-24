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
  verdict: string | null
  confidencePct: number | null
  objectiveToSet: boolean
}

const props = defineProps<{ race?: RaceRow; today: string; loading?: boolean }>()

const ui = useUiStore()

const countdown = computed(() => (props.race ? daysUntil(props.race.date, props.today) : null))
</script>

<template>
  <div
    v-if="loading"
    class="tile dial"
    style="border-color: rgba(242, 162, 58, 0.35)"
    aria-busy="true"
  >
    <div class="flex items-baseline justify-between">
      <span class="label"><UiInfoHint term="courseA">Course A</UiInfoHint></span>
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton :height="15" width="164px" />
    <UiSkeleton variant="block" :height="10" />
  </div>

  <button
    v-else-if="race"
    type="button"
    class="tile dial tile-action text-left"
    style="border-color: rgba(242, 162, 58, 0.35)"
    @click="ui.openDial('course-a')"
  >
    <span class="flex items-baseline justify-between gap-2">
      <span class="label truncate"
        ><UiInfoHint term="courseA">Course A</UiInfoHint> · {{ race.name }}</span
      >
    </span>

    <span class="display text-display-xl leading-none font-bold text-accent"
      >J−{{ countdown }}</span
    >

    <!-- Une seule métadonnée : l'écart de la projection à sa cible, en mots —
         la paire nue se lisait comme un intervalle (P20). Les deux chrono
         vivent dans le dialog, la confiance est l'échelle. -->
    <span
      class="mono text-meta"
      :class="race.projectionIsFloor && race.verdict ? 'text-warn' : 'text-text-dim'"
    >
      <template v-if="race.objectiveToSet">objectif à fixer</template>
      <template v-else-if="race.verdict">{{ race.verdict }}</template>
      <template v-else>projection à venir</template>
    </span>

    <!-- L'échelle situe le décompte : la confiance de tenir l'objectif. -->
    <span class="relative block h-[10px]">
      <span class="absolute inset-x-0 top-[4px] h-[3px] rounded-sm bg-accent-track" />
      <span
        v-if="race.confidencePct !== null"
        class="absolute top-[4px] h-[3px] rounded-sm bg-accent"
        :style="{ width: `${race.confidencePct}%` }"
      />
    </span>
  </button>

  <!-- Sans course, le cadran montre son gabarit : le tiret et l'échelle en
       creux disent qu'il y a une mesure à venir (§ 8, P5.21). -->
  <div v-else class="tile dial border-dashed">
    <div class="flex items-baseline justify-between">
      <span class="label"><UiInfoHint term="courseA">Course A</UiInfoHint></span>
    </div>

    <span class="display text-display-xl leading-none font-bold text-text-dim">—</span>

    <div class="flex items-baseline gap-4">
      <span class="mono text-meta text-text-dim">aucune course à venir</span>
      <NuxtLink to="/courses" class="mono ml-auto text-meta text-accent">en ajouter</NuxtLink>
    </div>

    <div class="relative h-[10px]">
      <span class="absolute inset-x-0 top-[4px] h-[3px] rounded-sm bg-accent-track" />
    </div>
  </div>
</template>
