<script setup lang="ts">
/**
 * Le dialog d'une séance, et — depuis P6.4 — celui d'un jour de repos, qui
 * n'avait rien à ouvrir. Sans séance, il ne reste du jour que ses repas.
 */
import type { PlanSession } from '~/stores/plan'
import { EQUIPMENT_LABELS, StrengthEquipment } from '~~/server/domain/strength/equipment'

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

/** Les trois chiffres du sport (§ 8, P11.1), partagés avec la tuile du jour. */
const figures = computed(() => (session.value ? sessionFigures(session.value) : []))

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
  lastReps: number | null
  suggestedReps: number | null
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

/**
 * Au poids de corps, il n'y a pas de charge à proposer : c'est le format qui
 * progresse, et il s'affiche à la même place (§ 5, P11.3).
 */
const formats = computed(() =>
  Object.fromEntries(
    (strength.value?.exercises ?? [])
      .filter((item) => item.lastLoadKg === null && item.suggestedReps !== null)
      .map((item) => [item.exerciseId, item]),
  ),
)

const athleteStore = useAthleteStore()

/** Le matériel déclaré ; sans déclaration, la salle (§ 5, P11.3). */
const equipment = computed(
  () => athleteStore.athlete?.constraints?.equipment ?? StrengthEquipment.Gym,
)

const bodyweight = computed(() => equipment.value === StrengthEquipment.None)

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

/** Une journée posée à la main : le générateur ne la retouche plus (§ 5, P6.43). */
const manualDay = computed(() =>
  (plan.plan?.sessions ?? []).some((item) => item.date === day.value && item.origin === 'manuelle'),
)

const editable = computed(
  () =>
    session.value !== undefined &&
    session.value.status !== 'faite' &&
    session.value.status !== 'annulee' &&
    session.value.date >= plan.today,
)

const editing = ref(false)
const adding = ref(false)
const editError = ref('')

/**
 * Une séance faite est un enregistrement, pas un formulaire (§ 8, P12) : la
 * fenêtre s'ouvre en lecture, et les blocs de saisie se prennent par la porte.
 */
const done = computed(() => session.value?.status === 'faite')
const correcting = ref(false)
const reading = computed(() => done.value && !correcting.value)

watch(session, () => (correcting.value = false))

/** La trace relevée, quand la séance a été courue depuis le cockpit (P10.1). */
const { data: track } = useFetch<{
  track: { runId: number; points: { lat: number; lon: number }[]; distanceM: number } | null
}>(() => `/api/sessions/${session.value?.id}/track`, {
  immediate: computed(() => done.value && session.value?.sport === 'course') as unknown as boolean,
  default: () => ({ track: null }),
})

async function cancelSession() {
  if (!session.value) return
  editError.value = ''
  try {
    await $fetch(`/api/sessions/${session.value.id}/cancel`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    editError.value = apiMessage(failure, 'Retrait impossible.')
  }
}

async function restoreDay() {
  if (!day.value) return
  editError.value = ''
  try {
    await $fetch(`/api/plan/days/${day.value}`, { method: 'DELETE' })
    emit('saved')
  } catch (failure) {
    editError.value = apiMessage(failure, 'Impossible de rendre la journée au moteur.')
  }
}

const swapError = ref('')

async function replaceWithRun() {
  if (!session.value) return

  swapError.value = ''
  try {
    await $fetch(`/api/sessions/${session.value.id}/run-swap`, { method: 'POST' })
    emit('saved')
  } catch (failure) {
    swapError.value = apiMessage(failure, 'Remplacement impossible.')
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
      <span v-if="manualDay" class="pill ml-auto">posé à la main</span>
    </div>

    <!-- Une sortie qui n'était pas prévue se lance d'ici, et d'ici seulement :
         l'écran principal ne gagne pas une action de plus (§ 8, P10.3). -->
    <div v-if="day === plan.today" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Sortir quand même</span>
      <NuxtLink to="/en-course" class="btn btn-ghost self-stretch lean:self-start">
        <UiAppIcon name="run" :size="15" />
        Courir sans séance prévue
      </NuxtLink>
      <span class="text-[12px] text-text-dim">
        La sortie se rattache à une séance du jour si elle lui ressemble, sinon elle compte hors
        plan.
      </span>
    </div>

    <!-- Une journée vide n'avait aucun moyen de recevoir une séance (§ 9, P6.43). -->
    <div v-if="day >= plan.today" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Ajouter une séance</span>

      <PlanSessionForm v-if="adding" :date="day" @saved="emit('saved')" />
      <button
        v-else
        type="button"
        class="btn btn-ghost self-stretch lean:self-start"
        @click="adding = true"
      >
        <UiAppIcon name="plus" :size="15" />
        Poser une séance ce jour-là
      </button>

      <UiActionButton
        v-if="manualDay"
        class="btn btn-ghost self-stretch lean:self-start"
        :action="restoreDay"
      >
        Rendre la journée au moteur
      </UiActionButton>
      <p v-if="editError" class="text-[13px] text-warn">{{ editError }}</p>
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
      <span v-else-if="session.status === 'annulee'" class="pill ml-auto">retirée</span>
      <span v-if="manualDay" class="pill">posé à la main</span>
      <!-- Le matériel dit ce que la séance suppose, une fois (§ 5, P11.3). -->
      <span v-if="session.sport === 'muscu'" class="pill">{{ EQUIPMENT_LABELS[equipment] }}</span>

      <!-- La porte de l'édition : une icône seule au pouce, son mot au-dessus
           de la rupture (§ 8, P12). -->
      <button
        v-if="done"
        type="button"
        class="btn btn-ghost size-11 shrink-0 justify-center p-0 lean:size-auto lean:px-3"
        :aria-label="correcting ? 'Quitter l’édition' : 'Corriger cette séance'"
        @click="correcting = !correcting"
      >
        <UiAppIcon :name="correcting ? 'check' : 'pen'" :size="16" />
        <span class="hidden lean:inline">{{ correcting ? 'Terminer' : 'Corriger' }}</span>
      </button>
    </div>

    <!-- Les trois chiffres du sport, les mêmes que sur la tuile du jour : une
         seule fonction les rend, la fenêtre n'en recalcule aucun (§ 8, P11.1). -->
    <div class="flex flex-wrap gap-x-8 gap-y-2">
      <span v-for="figure in figures" :key="figure.key" class="flex flex-col items-start">
        <span class="mono text-[17px]">{{ figure.value }}</span>
        <span class="label text-[9.5px]">{{ figure.label }}</span>
        <span v-if="figure.planned" class="mono text-[10.5px] text-text-dim">
          prévu {{ figure.planned }}
        </span>
      </span>
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
                · {{ formatSeconds(step.durationS) }}
              </template>
              <template v-if="step.paceSecPerKm">
                · {{ formatPace(step.paceSecPerKm) }}/km
              </template>
              <template v-if="step.tempo"> · tempo {{ step.tempo }}</template>
              <template v-if="step.recoveryS">
                · récup {{ formatSeconds(step.recoveryS) }}</template
              >
              <template v-if="loads[step.exerciseId ?? '']">
                ·
                <span class="text-text-dim line-through">
                  {{ formatLoad(loads[step.exerciseId!]!.lastLoadKg) }}
                </span>
                <span class="ml-1 text-accent">
                  {{ formatLoad(loads[step.exerciseId!]!.suggestedLoadKg) }}
                </span>
              </template>
              <template v-else-if="formats[step.exerciseId ?? '']">
                ·
                <span class="text-text-dim line-through">
                  {{ step.repeats }} × {{ formats[step.exerciseId!]!.lastReps
                  }}{{ step.isometric ? '″' : '' }}
                </span>
                <span class="ml-1 text-accent">
                  {{ step.repeats }} × {{ formats[step.exerciseId!]!.suggestedReps
                  }}{{ step.isometric ? '″' : '' }}
                </span>
              </template>
            </span>
            <!-- Un remplacement se dit sous l'exercice qu'on fait, pas ailleurs. -->
            <span v-if="step.replacesLabel" class="text-[12px] text-text-dim">
              Remplace {{ step.replacesLabel }} : le matériel qu'il demande n'est pas déclaré.
            </span>
            <span v-if="step.note" class="text-[12px] text-text-dim">{{ step.note }}</span>
          </div>
        </div>

        <!-- Ce qu'une séance sans charge n'obtient pas, dit une fois et ici
             seulement : la fenêtre de la séance, nulle part ailleurs (P11.3). -->
        <div v-if="session.sport === 'muscu' && bodyweight" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Ce que cette séance ne fait pas</span>
          <p class="text-[13px] text-text-dim">
            Sans charge externe, pas de force maximale : c'est elle qui fait gagner en économie de
            course. Ce qui reste acquis, et c'est le principal, c'est la réduction du risque de
            blessure.
          </p>
        </div>

        <!-- Une journée peut recevoir une séance de plus, vide ou non (P6.43).
             Sur une séance faite, c'est de la saisie : elle passe par la porte. -->
        <div v-if="session.date >= plan.today && !reading" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Ajouter une séance ce jour-là</span>

          <PlanSessionForm v-if="adding" :date="session.date" @saved="emit('saved')" />
          <button
            v-else
            type="button"
            class="btn btn-ghost self-stretch lean:self-start"
            @click="adding = true"
          >
            <UiAppIcon name="plus" :size="15" />
            Poser une séance de plus
          </button>
        </div>

        <!--
          Les deux gestes de la main : changer la séance pour celle qu'on veut,
          ou la retirer sans la compter comme manquée. Le moteur dit ce que ça
          coûte, il ne l'interdit pas (§ 1, P6.43).
        -->
        <div v-if="editable" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Changer cette séance</span>

          <PlanSessionForm
            v-if="editing"
            :date="session.date"
            :session-id="session.id"
            :initial="{ sport: session.sport, code: session.code, durationMin: plannedMinutes }"
            @saved="emit('saved')"
          />

          <div v-else class="flex flex-col gap-2 lean:flex-row">
            <button type="button" class="btn btn-ghost flex-1" @click="editing = true">
              Remplacer
            </button>
            <UiActionButton class="btn btn-ghost flex-1" :action="cancelSession">
              Retirer du plan
            </UiActionButton>
          </div>

          <UiActionButton
            v-if="manualDay"
            class="btn btn-ghost self-stretch lean:self-start"
            :action="restoreDay"
          >
            Rendre la journée au moteur
          </UiActionButton>
          <p v-if="editError" class="text-[13px] text-warn">{{ editError }}</p>
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

            <UiActionButton
              class="btn btn-ghost self-stretch lean:self-start"
              icon="run"
              :icon-size="15"
              :action="replaceWithRun"
            >
              Remplacer par une sortie course
            </UiActionButton>
          </template>

          <span v-else-if="swap" class="text-[12px] text-text-dim">{{ swap.refusal }}</span>

          <p v-if="swapError" class="text-[13px] text-warn">{{ swapError }}</p>
        </div>

        <!--
          La séance part sur la montre en un fichier. L'itinéraire garde son
          bloc, celui-ci garde le sien : une seule action principale par ligne
          (§ 8, P6.7).
        -->
        <div v-if="session.sport === 'course' && !done" class="tile bg-surface-inset">
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

        <!-- Une séance faite peut aller au cercle, et rien d'autre (§ 8, P9.2). -->
        <CircleShareRow v-if="session.status === 'faite'" source="seance" :source-id="session.id" />

        <!-- Trois lignes courtes ne sont pas un objet à axe : la table se
             replie au lieu de défiler, et ses deux titres se disent une fois
             en tête (§ 8, P12). -->
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Prescrit contre réalisé</span>
          <table class="w-full text-[13px]">
            <thead>
              <tr>
                <th class="label pb-1 text-left text-[10px] font-semibold"></th>
                <th class="label pb-1 text-right text-[10px] font-semibold">Prévu</th>
                <th class="label pb-1 text-right text-[10px] font-semibold">Réalisé</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-t border-line-soft">
                <td class="py-[6px] text-text-dim">Durée</td>
                <td class="mono py-[6px] text-right">{{ plannedMinutes }} min</td>
                <td class="mono py-[6px] text-right">
                  {{ session.actualDurationMin ? `${session.actualDurationMin} min` : '—' }}
                </td>
              </tr>
              <tr v-if="session.prescription.totalDistanceM > 0" class="border-t border-line-soft">
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
        </div>

        <!-- Une sortie à venir a besoin d'un parcours : il se demande ici, à
             la distance de la séance, depuis l'adresse du profil (§ 9, P5.5).
             Une course faite ne se retrace pas (§ 8, P12). -->
        <SessionsRouteSuggestion
          v-if="!done && session.sport === 'course' && session.prescription.totalDistanceM > 0"
          :session-id="session.id"
          :distance-m="session.prescription.totalDistanceM"
        />

        <!-- Ce qui a été couru, quand la sortie est partie du cockpit (P10.1).
             Sans trace, le bloc n'existe pas : il ne propose rien à la place. -->
        <div v-if="done && track?.track" class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Trace</span>
          <!-- Leaflet ne se rend que dans un navigateur (§ 8, P5.5). -->
          <ClientOnly>
            <UiRouteMap :points="track.track.points" :height="220" />
          </ClientOnly>
          <a
            :href="`/api/sessions/${session.id}/track.gpx`"
            class="btn btn-ghost self-stretch lean:self-start"
            download
          >
            <UiAppIcon name="route" :size="15" />
            Télécharger la trace
          </a>
        </div>

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

      <!-- Le retour de séance est de la saisie : sur une séance faite il ne
           se montre qu'en édition, pour corriger le réalisé (§ 8, P12). -->
      <div
        v-if="!reading"
        class="border-t border-line-soft pt-4 lean:border-t-0 lean:border-l lean:pt-0 lean:pl-6"
      >
        <span class="label text-[10.5px]">{{
          done ? 'Corriger le réalisé' : 'Retour de séance'
        }}</span>
        <FeedbackForm
          :session="session"
          :watch-zones="plan.pause?.watchZones ?? plan.lastWatchZones"
          @saved="emit('saved')"
        />
      </div>
    </div>
  </div>
</template>
