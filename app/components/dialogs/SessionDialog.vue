<script setup lang="ts">
const props = defineProps<{ sessionId: number }>()
const emit = defineEmits<{ saved: [] }>()

const plan = usePlanStore()

const session = computed(() => plan.plan?.sessions.find((item) => item.id === props.sessionId))

/** Rôle de la séance dans la semaine : c'est ce qui justifie sa place (§ 8). */
const role = computed(() => {
  const current = session.value
  if (!current) return ''
  if (current.sport !== 'course') return SPORT_LABELS[current.sport] ?? current.sport
  return current.key ? 'Séance clé de la semaine' : 'Séance d’entretien'
})

const week = computed(() => plan.plan?.weeks.find((item) => item.id === session.value?.weekId))

/** Mêmes séances du plan, pour situer celle-ci dans la progression. */
const history = computed(() => {
  const current = session.value
  if (!current) return []
  return (plan.plan?.sessions ?? [])
    .filter((item) => item.code === current.code && item.id !== current.id)
    .filter((item) => item.date <= plan.today)
    .slice(-5)
    .reverse()
})

const plannedMinutes = computed(() => {
  const prescription = session.value?.prescription
  if (!prescription) return 0
  if (prescription.durationMin) return prescription.durationMin

  const seconds = prescription.steps.reduce((total, step) => {
    const repeats = step.repeats ?? 1
    if (step.durationS) return total + (step.durationS + (step.recoveryS ?? 0)) * repeats
    if (step.distanceM && step.paceSecPerKm) {
      return total + (step.distanceM / 1000) * step.paceSecPerKm * repeats
    }
    return total
  }, 0)
  return Math.round(seconds / 60)
})
</script>

<template>
  <div v-if="session" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <UiAppIcon
        :name="sportStyle(session.sport).icon"
        :size="18"
        :class="sportStyle(session.sport).tone"
      />
      <span class="display text-[22px] font-semibold">
        {{ SESSION_LABELS[session.code] ?? session.code }}
      </span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ formatLongDate(session.date) }} · {{ role }}
        <template v-if="week"> · semaine {{ week.index }}</template>
      </span>
      <span v-if="session.status === 'faite'" class="pill pill-done ml-auto">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill ml-auto">manquée</span>
    </div>

    <div class="grid grid-cols-[1.3fr_1fr] gap-6">
      <div class="flex flex-col gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Structure</span>
          <div
            v-for="step in session.prescription.steps"
            :key="step.label"
            class="flex flex-col gap-px border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
          >
            <span class="flex items-baseline gap-2">
              <span class="text-[13px]">
                <template v-if="step.repeats && !step.exerciseId">{{ step.repeats }} × </template>
                {{ step.label }}
              </span>
              <span v-if="step.repeats && step.reps" class="mono text-[12px] text-text-dim">
                {{ step.repeats }} × {{ step.reps }}{{ step.isometric ? '″' : '' }}
              </span>
              <span v-if="step.intensity" class="pill ml-auto text-[10.5px]">
                {{ step.intensity }}
              </span>
            </span>
            <span class="mono text-[12px] text-text-muted">
              <template v-if="step.distanceM">{{ formatDistance(step.distanceM) }}</template>
              <template v-if="step.durationS && !step.reps">
                · {{ formatMinutes(step.durationS / 60) }}
              </template>
              <template v-if="step.paceSecPerKm">
                · {{ formatPace(step.paceSecPerKm) }}/km
              </template>
              <template v-if="step.recoveryS"> · récup {{ step.recoveryS }}″</template>
            </span>
            <span v-if="step.note" class="text-[12px] text-text-muted">{{ step.note }}</span>
          </div>
        </div>

        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Prescrit contre réalisé</span>
          <table class="w-full text-[13px]">
            <tbody>
              <tr class="border-b border-line-soft">
                <td class="py-[6px] text-text-muted">Durée</td>
                <td class="mono py-[6px] text-right">{{ plannedMinutes }} min</td>
                <td class="mono py-[6px] text-right">
                  {{ session.actualDurationMin ? `${session.actualDurationMin} min` : '—' }}
                </td>
              </tr>
              <tr v-if="session.prescription.totalDistanceM > 0">
                <td class="py-[6px] text-text-muted">Distance</td>
                <td class="mono py-[6px] text-right">
                  {{ formatDistance(session.prescription.totalDistanceM) }}
                </td>
                <td class="mono py-[6px] text-right">
                  {{ session.actualDistanceM ? formatDistance(session.actualDistanceM) : '—' }}
                </td>
              </tr>
              <tr class="border-t border-line-soft">
                <td class="py-[6px] text-text-muted">RPE</td>
                <td class="mono py-[6px] text-right">{{ session.prescription.expectedRpe }}</td>
                <td class="mono py-[6px] text-right">{{ session.feedbackRpe ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="history.length > 0" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Les fois d'avant</span>
          <div
            v-for="item in history"
            :key="item.id"
            class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
          >
            <span class="mono text-[12px] text-text-muted">{{ formatDate(item.date) }}</span>
            <span class="mono text-[12.5px]">
              <template v-if="item.prescription.totalDistanceM > 0">
                {{ formatDistance(item.actualDistanceM ?? item.prescription.totalDistanceM) }}
              </template>
              <template v-else>
                {{ formatMinutes(item.actualDurationMin ?? item.prescription.durationMin) }}
              </template>
            </span>
            <span v-if="item.feedbackRpe" class="pill ml-auto">RPE {{ item.feedbackRpe }}</span>
            <span v-else-if="item.status === 'sautee'" class="pill ml-auto">manquée</span>
          </div>
        </div>
      </div>

      <div class="border-l border-line-soft pl-6">
        <span class="label text-[10.5px]">Retour de séance</span>
        <FeedbackForm
          :session="session"
          :watch-zones="plan.pause?.watchZones ?? plan.lastWatchZones"
          @saved="emit('saved')"
        />
      </div>
    </div>
  </div>
</template>
