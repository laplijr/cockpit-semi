<script setup lang="ts">
const props = defineProps<{ activityId: number }>()
const emit = defineEmits<{ corrected: [] }>()

const plan = usePlanStore()

/** L'activité vient du plan déjà chargé : la case qui l'ouvre l'affichait. */
const activity = computed(() => plan.offPlan.find((item) => item.id === props.activityId))

const rpe = ref(activity.value?.rpe ?? 1)
const error = ref('')

const changed = computed(() => activity.value !== undefined && rpe.value !== activity.value.rpe)
const nextLoadUa = computed(() => Math.round(rpe.value * (activity.value?.durationMin ?? 0)))

async function save() {
  error.value = ''
  try {
    await $fetch(`/api/activities/${props.activityId}/rpe`, {
      method: 'PUT',
      body: { rpe: rpe.value },
    })
    emit('corrected')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  }
}
</script>

<template>
  <div v-if="activity" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="display text-display-s font-semibold">
        {{ activity.name ?? SPORT_LABELS[activity.sport] ?? activity.sport }}
      </span>
      <span class="mono text-meta text-text-dim">
        {{ formatDate(activity.date) }} · {{ SPORT_LABELS[activity.sport] ?? activity.sport }}
      </span>
    </div>

    <p class="text-body text-text-dim">
      Aucune séance du plan ne l'a absorbée : elle compte seule dans la charge du jour.
    </p>

    <div class="grid grid-cols-1 gap-4 lean:grid-cols-2">
      <div class="tile bg-surface-inset">
        <span class="label text-caption">Durée</span>
        <span class="mono text-copy">{{ formatMinutes(activity.durationMin) }}</span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-caption">
          <UiInfoHint term="chargeCombinee">Charge</UiInfoHint>
        </span>
        <span class="mono text-copy">
          <template v-if="changed">
            <span class="text-text-dim line-through">{{ activity.loadUa }}</span>
            <span class="mx-2 text-text-dim">→</span>
          </template>
          {{ changed ? nextLoadUa : activity.loadUa }} UA
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-[6px]">
      <span id="activite-rpe" class="label text-caption">
        <UiInfoHint term="rpe">Effort perçu</UiInfoHint> — RPE {{ rpe }}
        <template v-if="activity.rpeIsDefault && !changed">, par défaut</template>
      </span>
      <input
        v-model.number="rpe"
        type="range"
        min="1"
        max="10"
        aria-labelledby="activite-rpe"
        class="w-full accent-accent"
      />
    </div>

    <p v-if="error" class="text-meta text-warn">{{ error }}</p>

    <div class="grid grid-cols-1 gap-2 lean:flex">
      <UiActionButton class="btn" :disabled="!changed" :action="save">Enregistrer</UiActionButton>
    </div>
  </div>
</template>
