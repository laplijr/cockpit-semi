<script setup lang="ts">
import { EQUIPMENT_LABELS, type StrengthEquipment } from '~~/server/domain/strength/equipment'
import { StrengthEffort } from '~~/server/domain/strength/exercises'
import { loadHint, reserveLabel, targetReserve } from '~~/server/domain/strength/reserve'

interface Exercise {
  id: string
  label: string
  effort: string
  equipment?: string
  fallbackId?: string
  sets: number
  reps: number
  tempo?: string
  defaultIntensity?: string
  isometric?: boolean
  benefits: string[]
  lowerBody: boolean
  progression?: {
    fromSets: number
    fromReps: number
    toSets: number
    toReps: number
    weeks: number
  }
  why: string
}

const props = defineProps<{ exerciseId: string }>()

const { data } = await useFetch('/api/library/strength')

const exercise = computed<Exercise | undefined>(() =>
  (data.value?.exercises ?? []).find((item) => item.id === props.exerciseId),
)

const lastLoadKg = computed(() => data.value?.lastLoadsKg?.[props.exerciseId] ?? null)

const technique = computed(() => data.value?.technique[props.exerciseId])

const muscles = computed(() =>
  technique.value
    ? [
        ...technique.value.primary.map((muscle) => ({ muscle, primary: true })),
        ...technique.value.secondary.map((muscle) => ({ muscle, primary: false })),
      ]
    : [],
)

/**
 * La dose d'aujourd'hui : l'exercice principal suit la phase, les autres
 * gardent leur repère (§ 5). C'est elle qui dit quelle réserve garder.
 */
const dose = computed(() => {
  const current = exercise.value
  if (!current || !data.value) return null
  const main = current.effort === StrengthEffort.MaxStrength
  const intensity = main ? data.value.dose.intensity : current.defaultIntensity
  const reps = main ? data.value.dose.reps : current.reps
  return { reps, reserve: targetReserve(intensity) }
})
const lastReps = computed(() => data.value?.lastReps?.[props.exerciseId] ?? null)

/**
 * La chaîne de substitution entière, du plus fourni au plus nu, avec le
 * niveau courant marqué : on voit ce qu'on ferait avec plus de matériel, et
 * l'exercice qu'on fait aujourd'hui (§ 5, P11.3).
 */
const chain = computed<Exercise[]>(() => {
  const all = (data.value?.exercises ?? []) as Exercise[]
  const byId = new Map(all.map((item) => [item.id, item]))
  const head = all.find((item) => item.fallbackId === props.exerciseId)
  const root = head ? rootOf(head, all) : byId.get(props.exerciseId)

  const list: Exercise[] = []
  let current = root
  while (current && !list.includes(current)) {
    list.push(current)
    current = current.fallbackId ? byId.get(current.fallbackId) : undefined
  }
  return list.length > 1 ? list : []
})

/** Remonte la chaîne : un exercice peut être le remplaçant d'un autre. */
function rootOf(exercise: Exercise, all: Exercise[]): Exercise {
  const parent = all.find((item) => item.fallbackId === exercise.id)
  return parent ? rootOf(parent, all) : exercise
}
</script>

<template>
  <div v-if="exercise" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-display-s font-semibold">{{ exercise.label }}</span>
      <span class="mono text-meta text-text-dim">
        {{ exercise.sets }} × {{ exercise.reps }}{{ exercise.isometric ? '″' : '' }}
      </span>
      <span v-if="exercise.lowerBody" class="pill ml-auto">jambes en charge</span>
    </div>

    <!-- Le geste d'abord : la figure au tempo prescrit, puis comment faire,
         ce qu'il faut éviter, les muscles et la charge. Ce qui existait —
         l'apport, la progression, ce qui a été tenu — vient ensuite (P25). -->
    <div class="grid grid-cols-1 gap-4 lean:grid-cols-[auto_1fr] lean:gap-6">
      <div class="flex flex-col items-center gap-2">
        <UiExerciseFigure
          :exercise-id="exercise.id"
          :tempo="exercise.tempo"
          :hold-s="exercise.isometric ? exercise.reps : undefined"
          :width="140"
        />
        <span v-if="tempoWords(exercise.tempo)" class="mono text-center text-meta text-text-dim">
          {{ tempoWords(exercise.tempo) }}
        </span>
      </div>

      <div v-if="technique" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <span class="label text-caption">Comment faire</span>
          <ol class="flex flex-col gap-1 text-body">
            <li v-for="(cue, index) in technique.cues" :key="index" class="flex gap-2">
              <span class="mono shrink-0 text-text-dim">{{ index + 1 }}.</span>
              <span>{{ cue }}</span>
            </li>
          </ol>
        </div>

        <div class="flex flex-col gap-2">
          <span class="label text-caption">À éviter</span>
          <ul class="flex flex-col gap-1 text-body text-text-dim">
            <li v-for="mistake in technique.mistakes" :key="mistake">{{ mistake }}</li>
          </ul>
        </div>

        <div class="flex flex-wrap gap-1">
          <span
            v-for="item in muscles"
            :key="item.muscle"
            class="pill"
            :class="item.primary && 'text-text'"
          >
            {{ data?.muscleLabels[item.muscle] ?? item.muscle }}
          </span>
        </div>
      </div>
    </div>

    <!-- La charge : les kilos quand ils sont connus, sinon le format et la
         réserve — jamais un pourcentage d'un maximum jamais mesuré (P25). -->
    <div v-if="dose?.reserve !== null && dose?.reserve !== undefined" class="tile bg-surface-inset">
      <span class="label text-caption">
        <UiInfoHint term="reserve">La charge</UiInfoHint>
      </span>
      <p v-if="lastLoadKg" class="text-body">
        {{ formatLoad(lastLoadKg) }} la dernière fois, {{ reserveLabel(dose.reserve) }} à la
        dernière série.
      </p>
      <p v-else class="text-body">{{ loadHint(dose.reps, dose.reserve) }}</p>
    </div>

    <div class="flex flex-wrap gap-1">
      <span v-for="benefit in exercise.benefits" :key="benefit" class="pill">
        {{ BENEFIT_LABELS[benefit] ?? benefit }}
      </span>
    </div>

    <div class="tile bg-surface-inset">
      <span class="label text-caption">Ce qu'il apporte</span>
      <p class="text-body text-text-dim">{{ exercise.why }}</p>
    </div>

    <div class="fold-2 grid gap-4">
      <div v-if="exercise.progression" class="tile bg-surface-inset">
        <span class="label text-caption">Progression</span>
        <span class="mono text-copy">
          {{ exercise.progression.fromSets }} × {{ exercise.progression.fromReps }} →
          {{ exercise.progression.toSets }} × {{ exercise.progression.toReps }}
        </span>
        <span class="text-meta text-text-dim"> sur {{ exercise.progression.weeks }} semaines </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-caption">Ce qui a été tenu</span>
        <!-- Des kilos quand il y a une charge, un format sinon : au poids de
             corps, c'est le format qui progresse (§ 5, P11.3). -->
        <span class="mono text-heading">
          <template v-if="lastLoadKg">{{ formatLoad(lastLoadKg) }}</template>
          <template v-else-if="lastReps">
            {{ lastReps }}{{ exercise.isometric ? '″' : ' rép.' }}
          </template>
          <template v-else>—</template>
        </span>
      </div>
    </div>

    <!-- La chaîne entière, le niveau courant marqué : ce que cet exercice
         devient avec plus ou moins de matériel (§ 5, P11.3). -->
    <div v-if="chain.length > 0" class="tile bg-surface-inset">
      <span class="label text-caption">Avec plus de matériel</span>
      <div
        v-for="item in chain"
        :key="item.id"
        class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
      >
        <span class="mono w-[150px] shrink-0 text-meta text-text-dim">
          {{ EQUIPMENT_LABELS[(item.equipment ?? 'aucun') as StrengthEquipment] }}
        </span>
        <span class="text-body" :class="item.id === exercise.id && 'text-accent'">
          {{ item.label }}
        </span>
        <span v-if="item.id === exercise.id" class="pill ml-auto">à faire</span>
      </div>
    </div>
  </div>
</template>
