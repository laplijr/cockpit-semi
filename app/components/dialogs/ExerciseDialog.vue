<script setup lang="ts">
interface Exercise {
  id: string
  label: string
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

    <div class="grid grid-cols-2 gap-4">
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
        <span class="label text-[10.5px]">Dernière charge tenue</span>
        <span class="mono text-[20px]">{{ formatLoad(lastLoadKg) }}</span>
        <span v-if="lastLoadKg === null" class="text-[12px] text-text-dim">
          Elle apparaîtra après la première séance enregistrée.
        </span>
      </div>
    </div>

    <p v-if="exercise.lowerBody" class="text-[13px] text-text-dim">
      Cet exercice charge les jambes : il est retiré du plan quand une pause interdit le
      renforcement des jambes.
    </p>
  </div>
</template>
