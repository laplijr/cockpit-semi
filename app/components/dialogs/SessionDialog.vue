<script setup lang="ts">
/**
 * Le dialog d'une séance, et — depuis P6.4 — celui d'un jour de repos, qui
 * n'avait rien à ouvrir. Sans séance, il ne reste du jour que ses repas.
 */
import type { PlanSession } from '~/stores/plan'

const props = defineProps<{ sessionId?: number | null; date?: string | null }>()
const emit = defineEmits<{ saved: [] }>()

const plan = usePlanStore()

/**
 * Visé par identifiant, ou par date : un jour ouvert depuis Nutrition montre sa
 * séance principale, et un jour de repos n'a que ses repas.
 */
const session = computed(() => {
  const sessions = plan.plan?.sessions ?? []
  if (props.sessionId) return sessions.find((item) => item.id === props.sessionId)
  if (!props.date) return undefined

  const ofDay = sessions.filter((item) => item.date === props.date)
  return ofDay.find((item) => item.key) ?? ofDay[0]
})

const day = computed(() => session.value?.date ?? props.date ?? null)

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

interface StrengthState {
  exerciseId: string
  lastLoadKg: number | null
  suggestedLoadKg: number | null
}

/** Charges tenues et proposées, quand la séance est une muscu (§ 9, P5.9). */
const { data: strength } = useFetch<{ exercises: StrengthState[] }>(
  () => `/api/sessions/${props.sessionId}/strength`,
  { immediate: computed(() => session.value?.sport === 'muscu') as unknown as boolean },
)

const loads = computed(() =>
  Object.fromEntries(
    (strength.value?.exercises ?? [])
      .filter((item) => item.lastLoadKg !== null)
      .map((item) => [item.exerciseId, item]),
  ),
)

interface RideSwapGiveback {
  sessionId: number
  date: string
  takenM: number
}

interface RideSwapResponse {
  ok: boolean
  refusal?: string
  replacement?: {
    prescription: PlanSession['prescription']
    givebacks: RideSwapGiveback[]
    cappedAfterLongRun: boolean
  }
}

/** Une sortie vélo encore à faire aujourd'hui, et elle seule (§ 5, P6.42). */
const canSwap = computed(
  () =>
    session.value?.sport === 'velo' &&
    session.value.date === plan.today &&
    session.value.status === 'prevue',
)

const { data: swap } = useFetch<RideSwapResponse>(
  () => `/api/sessions/${session.value?.id}/run-swap`,
  { immediate: canSwap as unknown as boolean },
)

const replacement = computed(() => (swap.value?.ok ? swap.value.replacement : undefined))

/** Ce que la semaine rend pour payer la course ajoutée : sa cible ne bouge pas. */
const givebackText = computed(() => {
  const item = replacement.value
  if (!item) return ''

  const taken = item.givebacks.reduce((total, giveback) => total + giveback.takenM, 0)
  const lenders =
    item.givebacks.length > 1
      ? `aux ${item.givebacks.length} endurances suivantes`
      : 'à l’endurance suivante'
  const base = `Les ${formatDistance(taken)} ajoutés sont repris ${lenders} de la semaine : le volume de course visé ne bouge pas.`

  return item.cappedAfterLongRun
    ? `${base} Elle est ramenée au minimum : c’est le lendemain de la sortie longue.`
    : base
})

const swapping = ref(false)
const swapError = ref('')

async function replaceWithRun() {
  if (!session.value) return

  swapping.value = true
  swapError.value = ''
  try {
    await $fetch(`/api/sessions/${session.value.id}/run-swap`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    swapError.value = apiMessage(failure, 'Remplacement impossible.')
  } finally {
    swapping.value = false
  }
}

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
  <!-- Un jour sans séance : il n'a ni structure ni ressenti, seulement ses repas. -->
  <div v-if="!session && day" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">Repos</span>
      <span class="mono text-[11.5px] text-text-dim">{{ formatLongDate(day) }}</span>
    </div>

    <NutritionDayMealPlan :date="day" />
  </div>

  <div v-else-if="session" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <UiAppIcon
        :name="sportStyle(session.sport).icon"
        :size="18"
        :class="sportStyle(session.sport).tone"
      />
      <span class="display text-[22px] font-semibold">
        {{ SESSION_LABELS[session.code] ?? session.code }}
      </span>
      <span class="mono text-[11.5px] text-text-dim">
        {{ formatLongDate(session.date) }} · {{ role }}
        <template v-if="week"> · semaine {{ week.index }}</template>
      </span>
      <span v-if="session.status === 'faite'" class="pill pill-done ml-auto">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill ml-auto">manquée</span>
    </div>

    <!-- La structure d'abord, le retour de séance ensuite : sur téléphone on
         lit ce qu'il y avait à faire avant de dire comment ça s'est passé. -->
    <div class="grid grid-cols-1 gap-4 lean:grid-cols-[1.3fr_1fr] lean:gap-6">
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
                {{ step.repeats }} × {{ step.reps }}{{ step.isometric ? '″' : ''
                }}{{ step.unilateral ? '/côté' : '' }}
              </span>
              <span v-if="step.superset" class="pill text-[10px]">superset</span>
              <span v-if="step.intensity" class="pill ml-auto text-[10.5px]">
                {{ step.intensity }}
              </span>
            </span>
            <span class="mono text-[12px] text-text-dim">
              <template v-if="step.distanceM">{{ formatDistance(step.distanceM) }}</template>
              <template v-if="step.durationS && !step.reps">
                · {{ formatMinutes(step.durationS / 60) }}
              </template>
              <template v-if="step.paceSecPerKm">
                · {{ formatPace(step.paceSecPerKm) }}/km
              </template>
              <template v-if="step.tempo"> · tempo {{ step.tempo }}</template>
              <template v-if="step.recoveryS"> · récup {{ step.recoveryS }}″</template>
              <template v-if="loads[step.exerciseId ?? '']">
                ·
                <span class="text-text-dim line-through">
                  {{ formatLoad(loads[step.exerciseId!]!.lastLoadKg) }}
                </span>
                <span class="ml-1 text-accent">
                  {{ formatLoad(loads[step.exerciseId!]!.suggestedLoadKg) }}
                </span>
              </template>
            </span>
            <span v-if="step.note" class="text-[12px] text-text-dim">{{ step.note }}</span>
          </div>
        </div>

        <!--
          Un vélo qu'on ne peut pas faire n'a d'issue que « manquée » : ici il
          devient une endurance, payée par les endurances suivantes de la
          semaine. Bouton fantôme — le retour de séance reste l'action
          principale de la fenêtre (§ 8, P6.42).
        -->
        <div v-if="canSwap" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Si tu ne peux pas la faire</span>

          <template v-if="replacement">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="mono text-[13px] text-text-dim line-through">
                {{ session.prescription.label }} · {{ formatMinutes(plannedMinutes) }}
              </span>
              <span class="mono text-[13px] text-accent">
                Endurance fondamentale ·
                {{ formatDistance(replacement.prescription.totalDistanceM) }} ·
                {{ formatMinutes(prescribedMinutes(replacement.prescription)) }}
              </span>
            </div>

            <span class="text-[12px] text-text-dim">{{ givebackText }}</span>

            <button
              type="button"
              class="btn btn-ghost self-stretch lean:self-start"
              :disabled="swapping"
              @click="replaceWithRun"
            >
              <UiAppIcon name="run" :size="15" />
              Remplacer par une sortie course
            </button>
          </template>

          <span v-else-if="swap" class="text-[12px] text-text-dim">{{ swap.refusal }}</span>

          <p v-if="swapError" class="text-[13px] text-warn">{{ swapError }}</p>
        </div>

        <!--
          La séance part sur la montre en un fichier. L'itinéraire garde son
          bloc, celui-ci garde le sien : une seule action principale par ligne
          (§ 8, P6.7).
        -->
        <div v-if="session.sport === 'course'" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Sur la montre</span>

          <a
            :href="`/api/sessions/${session.id}/workout.fit`"
            class="btn btn-ghost self-stretch lean:self-start"
            download
          >
            <UiAppIcon name="watch" :size="15" />
            Télécharger pour la montre
          </a>

          <span class="mono text-[11.5px] text-text-dim">
            Montre branchée en USB, fichier déposé dans
            <span class="text-text">GARMIN/NEWFILES/</span>
          </span>
        </div>

        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Prescrit contre réalisé</span>
          <UiAxisScroller>
            <table class="table-axis w-full text-[13px]">
              <tbody>
                <tr class="border-b border-line-soft">
                  <td class="py-[6px] text-text-dim">Durée</td>
                  <td class="mono py-[6px] text-right">{{ plannedMinutes }} min</td>
                  <td class="mono py-[6px] text-right">
                    {{ session.actualDurationMin ? `${session.actualDurationMin} min` : '—' }}
                  </td>
                </tr>
                <tr v-if="session.prescription.totalDistanceM > 0">
                  <td class="py-[6px] text-text-dim">Distance</td>
                  <td class="mono py-[6px] text-right">
                    {{ formatDistance(session.prescription.totalDistanceM) }}
                  </td>
                  <td class="mono py-[6px] text-right">
                    {{ session.actualDistanceM ? formatDistance(session.actualDistanceM) : '—' }}
                  </td>
                </tr>
                <tr class="border-t border-line-soft">
                  <td class="py-[6px] text-text-dim">RPE</td>
                  <td class="mono py-[6px] text-right">{{ session.prescription.expectedRpe }}</td>
                  <td class="mono py-[6px] text-right">{{ session.feedbackRpe ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </UiAxisScroller>
        </div>

        <!-- Une sortie a besoin d'un parcours : il se demande ici, à la
             distance de la séance, depuis l'adresse du profil (§ 9, P5.5). -->
        <SessionsRouteSuggestion
          v-if="session.sport === 'course' && session.prescription.totalDistanceM > 0"
          :session-id="session.id"
          :distance-m="session.prescription.totalDistanceM"
        />

        <!-- Les repas du jour vivent avec la séance : c'est elle qui décide de
             leurs heures (§ 9, P6.4). -->
        <NutritionDayMealPlan v-if="day" :date="day" />

        <div v-if="history.length > 0" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Les fois d'avant</span>
          <div
            v-for="item in history"
            :key="item.id"
            class="flex items-baseline gap-3 border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
          >
            <span class="mono text-[12px] text-text-dim">{{ formatDate(item.date) }}</span>
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

      <div class="border-t border-line-soft pt-4 lean:border-t-0 lean:border-l lean:pt-0 lean:pl-6">
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
