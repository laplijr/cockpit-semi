<script setup lang="ts">
import { EQUIPMENT_LABELS, type StrengthEquipment } from '~~/server/domain/strength/equipment'
interface Exercise {
  id: string
  label: string
  equipment?: string
  fallbackId?: string
  sets: number
  reps: number
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
      <span class="display text-[22px] font-semibold">{{ exercise.label }}</span>
      <span class="mono text-[11.5px] text-text-dim">
        {{ exercise.sets }} × {{ exercise.reps }}{{ exercise.isometric ? '″' : '' }}
      </span>
      <span v-if="exercise.lowerBody" class="pill ml-auto">jambes en charge</span>
    </div>

    <div class="flex flex-wrap gap-1">
      <span v-for="benefit in exercise.benefits" :key="benefit" class="pill">
        {{ BENEFIT_LABELS[benefit] ?? benefit }}
      </span>
    </div>

    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Ce qu'il apporte</span>
      <p class="text-[13px] text-text-dim">{{ exercise.why }}</p>
    </div>

    <div class="fold-2 grid gap-4">
      <div v-if="exercise.progression" class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Progression</span>
        <span class="mono text-[15px]">
          {{ exercise.progression.fromSets }} × {{ exercise.progression.fromReps }} →
          {{ exercise.progression.toSets }} × {{ exercise.progression.toReps }}
        </span>
        <span class="text-[12px] text-text-dim">
          sur {{ exercise.progression.weeks }} semaines
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Ce qui a été tenu</span>
        <!-- Des kilos quand il y a une charge, un format sinon : au poids de
             corps, c'est le format qui progresse (§ 5, P11.3). -->
        <span class="mono text-[20px]">
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
      <span class="label text-[10.5px]">Avec plus de matériel</span>
      <div
        v-for="item in chain"
        :key="item.id"
        class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
      >
        <span class="mono w-[150px] shrink-0 text-[11.5px] text-text-dim">
          {{ EQUIPMENT_LABELS[(item.equipment ?? 'aucun') as StrengthEquipment] }}
        </span>
        <span class="text-[13px]" :class="item.id === exercise.id && 'text-accent'">
          {{ item.label }}
        </span>
        <span v-if="item.id === exercise.id" class="pill ml-auto">à faire</span>
      </div>
    </div>
  </div>
</template>
