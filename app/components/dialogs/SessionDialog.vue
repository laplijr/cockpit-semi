<script setup lang="ts">
/**
 * Le dialog d'une séance, et — depuis P6.4 — celui d'un jour de repos, qui
 * n'avait rien à ouvrir. Sans séance, il ne reste du jour que ses repas.
 */
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

interface StrengthState {
  exerciseId: string
  lastLoadKg: number | null
  suggestedLoadKg: number | null
  lastReps: number | null
  suggestedReps: number | null
  toCalibrate: boolean
  plates: number[] | null
  recordedSets: unknown[]
}

/** Charges tenues et proposées, quand la séance est une muscu (§ 9, P5.9). */
const { data: strength } = useFetch<{ exercises: StrengthState[] }>(
  () => `/api/sessions/${props.sessionId}/strength`,
  { immediate: computed(() => session.value?.sport === 'muscu') as unknown as boolean },
)

/** L'état de chaque exercice de la séance, par identifiant. */
const states = computed<Record<string, StrengthState>>(() =>
  Object.fromEntries((strength.value?.exercises ?? []).map((item) => [item.exerciseId, item])),
)

/** Chargés, dosés en pourcentage et sans estimation : ils se calent avant la séance (P26). */
const toCalibrate = computed(() =>
  (session.value?.prescription.steps ?? []).filter(
    (step) => step.exerciseId && states.value[step.exerciseId]?.toCalibrate,
  ),
)

const athleteStore = useAthleteStore()

/** Le matériel déclaré ; sans déclaration, la salle (§ 5, P11.3). */
const equipment = computed(
  () => athleteStore.athlete?.constraints?.equipment ?? StrengthEquipment.Gym,
)

const bodyweight = computed(() => equipment.value === StrengthEquipment.None)

const ui = useUiStore()

/** Une sortie vélo encore à faire aujourd'hui, et elle seule (§ 5, P6.42). */
const canSwap = computed(
  () =>
    session.value?.sport === 'velo' &&
    session.value.date === plan.today &&
    session.value.status === 'prevue',
)

/** Une journée posée à la main : le générateur ne la retouche plus (§ 5, P6.43). */
const manualDay = computed(() =>
  (plan.plan?.sessions ?? []).some((item) => item.date === day.value && item.origin === 'manuelle'),
)

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

/** Une sortie de course ou de vélo à faire aujourd'hui : le pied porte « Courir » (P21). */
const runnable = computed(
  () =>
    ['course', 'velo'].includes(session.value?.sport ?? '') &&
    session.value?.date === plan.today &&
    session.value.status === 'prevue',
)

/** Une séance de renforcement du jour : elle se démarre en salle (P27). */
const gymToday = computed(
  () =>
    session.value?.sport === 'muscu' &&
    session.value.date === plan.today &&
    session.value.status === 'prevue',
)

/**
 * Commencée en salle : des séries sont déjà cochées. On ne la redémarre pas,
 * on vient dire comment elle s'est passée — la fenêtre descend au retour.
 */
const gymStarted = computed(
  () =>
    gymToday.value &&
    (strength.value?.exercises ?? []).some((item) => item.recordedSets.length > 0),
)
const feedbackBlock = ref<HTMLElement | null>(null)
watch(gymStarted, (started) => {
  if (started) nextTick(() => feedbackBlock.value?.scrollIntoView({ block: 'start' }))
})

const feedbackForm = ref<{ save: () => Promise<void> } | null>(null)

async function saveFeedback() {
  await feedbackForm.value?.save()
}

const plannedMinutes = computed(() =>
  session.value ? prescribedMinutes(session.value.prescription) : 0,
)
</script>

<template>
  <!-- Un jour sans séance : il n'a ni structure ni ressenti, seulement ses repas. -->
  <div v-if="!session && day" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-display-s font-semibold">Repos</span>
      <span class="mono text-meta text-text-dim">{{ formatLongDate(day) }}</span>
      <span v-if="manualDay" class="pill ml-auto">posé à la main</span>
    </div>

    <!-- Une sortie qui n'était pas prévue se lance d'ici, et d'ici seulement :
         l'écran principal ne gagne pas une action de plus (§ 8, P10.3). -->
    <div v-if="day === plan.today" class="tile bg-surface-inset">
      <span class="label text-caption">Sortir quand même</span>
      <NuxtLink to="/en-course" class="btn btn-ghost self-stretch lean:self-start">
        <UiAppIcon name="run" :size="15" />
        Courir sans séance prévue
      </NuxtLink>
      <span class="text-meta text-text-dim">
        La sortie se rattache à une séance du jour si elle lui ressemble, sinon elle compte hors
        plan.
      </span>
    </div>

    <!-- Une journée vide n'avait aucun moyen de recevoir une séance (§ 9, P6.43). -->
    <div v-if="day >= plan.today" class="tile bg-surface-inset">
      <span class="label text-caption">Ajouter une séance</span>

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
      <p v-if="editError" class="text-body text-warn">{{ editError }}</p>
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
      <span class="display text-display-s font-semibold">
        {{ SESSION_LABELS[session.code] ?? session.code }}
      </span>
      <span class="mono text-meta text-text-dim">
        {{ formatLongDate(session.date) }} · {{ role }}
        <template v-if="week"> · semaine {{ week.index }}</template>
      </span>
      <span v-if="session.status === 'faite'" class="pill pill-done ml-auto">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill ml-auto">manquée</span>
      <span v-else-if="session.status === 'annulee'" class="pill ml-auto">retirée</span>
      <span v-if="manualDay" class="pill">posé à la main</span>
      <!-- Le matériel dit ce que la séance suppose, une fois (§ 5, P11.3). -->
      <span v-if="session.sport === 'muscu'" class="pill">{{ EQUIPMENT_LABELS[equipment] }}</span>

      <!-- Au-dessus du pouce, « Démarrer » se prend dans la tête de la fenêtre ;
           au téléphone, dans son pied (P27). -->
      <NuxtLink
        v-if="gymToday"
        :to="`/en-salle/${session.id}`"
        class="btn btn-ghost ml-auto hidden lean:inline-flex"
      >
        {{ gymStarted ? 'Reprendre en salle' : 'Démarrer' }}
      </NuxtLink>

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
        <span class="mono text-title">{{ figure.value }}</span>
        <span class="label text-caption">{{ figure.label }}</span>
        <span v-if="figure.planned" class="mono text-caption text-text-dim">
          prévu {{ figure.planned }}
        </span>
      </span>
    </div>

    <!-- La structure d'abord, le retour de séance ensuite : sur téléphone on
         lit ce qu'il y avait à faire avant de dire comment ça s'est passé. -->
    <!-- Au pouce, la fenêtre commence par ce qu'on vient y faire : structure,
         retour de séance, puis ce qui l'entoure, et les gestes sur le plan en
         dernier. C'est le seul endroit où l'ordre change avec la largeur : la
         boucle du jour l'emporte sur la règle du § 8 (P21). Au-dessus de
         `lean`, l'ordre du DOM. -->
    <div class="flex flex-col gap-4 lean:grid lean:grid-cols-[1.3fr_1fr] lean:gap-6">
      <div class="contents lean:flex lean:flex-col lean:gap-4">
        <SessionsStructure :session="session" :states="states" />

        <!-- Un exercice sans estimation se cale avant la séance : le calage
             remplace l'échauffement, pas la séance (P26). -->
        <div
          v-if="toCalibrate.length > 0 && !reading"
          class="tile order-1 bg-surface-inset lean:order-none"
        >
          <span class="label text-caption">À caler</span>
          <p class="text-meta text-text-dim">
            Quelques paliers de cinq répétitions pour trouver la charge du jour, sans test de
            maximum.
          </p>
          <button
            v-for="step in toCalibrate"
            :key="step.exerciseId"
            type="button"
            class="btn btn-ghost self-stretch lean:self-start"
            @click="ui.openCalibration(step.exerciseId!, session.id)"
          >
            Caler : {{ step.label }}
          </button>
        </div>

        <!-- Ce qu'une séance sans charge n'obtient pas, dit une fois et ici
             seulement : la fenêtre de la séance, nulle part ailleurs (P11.3). -->
        <div
          v-if="session.sport === 'muscu' && bodyweight"
          class="tile order-1 bg-surface-inset lean:order-none"
        >
          <span class="label text-caption">Ce que cette séance ne fait pas</span>
          <p class="text-body text-text-dim">
            Sans charge externe, pas de force maximale : c'est elle qui fait gagner en économie de
            course. Ce qui reste acquis, et c'est le principal, c'est la réduction du risque de
            blessure.
          </p>
        </div>

        <SessionsPlanGestures
          :session="session"
          :planned-minutes="plannedMinutes"
          :manual-day="manualDay"
          :reading="reading"
          @saved="emit('saved')"
        />

        <SessionsRideSwap
          v-if="canSwap"
          :session="session"
          :planned-minutes="plannedMinutes"
          @saved="emit('saved')"
        />

        <!--
          La séance part sur la montre en un fichier. L'itinéraire garde son
          bloc, celui-ci garde le sien : une seule action principale par ligne
          (§ 8, P6.7).
        -->
        <div
          v-if="session.sport === 'course' && !done"
          class="tile order-3 bg-surface-inset lean:order-none"
        >
          <span class="label text-caption">Sur la montre</span>

          <a
            :href="`/api/sessions/${session.id}/workout.fit`"
            class="btn btn-ghost self-stretch lean:self-start"
            download
          >
            <UiAppIcon name="watch" :size="15" />
            Télécharger pour la montre
          </a>

          <span class="mono text-meta text-text-dim">
            Montre branchée en USB, fichier déposé dans
            <span class="text-text">GARMIN/NEWFILES/</span>
          </span>
        </div>

        <!-- Une séance faite peut aller au cercle, et rien d'autre (§ 8, P9.2). -->
        <CircleShareRow
          v-if="session.status === 'faite'"
          class="order-3 lean:order-none"
          source="seance"
          :source-id="session.id"
        />

        <SessionsPlannedVsActual v-if="done" :session="session" :planned-minutes="plannedMinutes" />

        <!-- Une sortie à venir a besoin d'un parcours : il se demande ici, à
             la distance de la séance, depuis l'adresse du profil (§ 9, P5.5).
             Une course faite ne se retrace pas (§ 8, P12). -->
        <SessionsRouteSuggestion
          v-if="!done && session.sport === 'course' && session.prescription.totalDistanceM > 0"
          class="order-3 lean:order-none"
          :session-id="session.id"
          :distance-m="session.prescription.totalDistanceM"
        />

        <!-- Ce qui a été couru, quand la sortie est partie du cockpit (P10.1).
             Sans trace, le bloc n'existe pas : il ne propose rien à la place. -->
        <div v-if="done && track?.track" class="tile order-3 bg-surface-inset lean:order-none">
          <span class="label text-caption">Trace</span>
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
        <NutritionDayMealPlan v-if="day" class="order-3 lean:order-none" :date="day" />

        <SessionsHistory :session="session" />
      </div>

      <!-- Le retour de séance est de la saisie : sur une séance faite il ne
           se montre qu'en édition, pour corriger le réalisé (§ 8, P12). -->
      <div
        v-if="!reading"
        ref="feedbackBlock"
        class="order-2 border-t border-line-soft pt-4 lean:order-none lean:border-t-0 lean:border-l lean:pt-0 lean:pl-6"
        :class="
          runnable || (gymToday && !gymStarted)
            ? 'max-lean:[&_.feedback-submit]:static'
            : 'max-lean:[&_.feedback-submit]:hidden'
        "
      >
        <span class="label text-caption">{{
          done ? 'Corriger le réalisé' : 'Retour de séance'
        }}</span>
        <FeedbackForm
          ref="feedbackForm"
          :session="session"
          :watch-zones="plan.pause?.watchZones ?? plan.lastWatchZones"
          @saved="emit('saved')"
        />
      </div>
    </div>

    <!-- Le pied de la feuille porte l'action du moment, sous le pouce et
         au-dessus de la zone sûre : partir avant la séance, dire comment
         elle s'est passée ensuite (P21). -->
    <div
      v-if="runnable || gymToday || !reading"
      class="sticky bottom-[calc(-18px-env(safe-area-inset-bottom))] z-10 -mx-[18px] -mb-[calc(18px+env(safe-area-inset-bottom))] border-t border-line bg-surface px-[18px] pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lean:hidden"
    >
      <NuxtLink
        v-if="gymToday && !gymStarted"
        :to="`/en-salle/${session.id}`"
        class="btn btn-lg w-full"
      >
        Démarrer
      </NuxtLink>
      <NuxtLink
        v-else-if="runnable"
        :to="`/en-course?seance=${session.id}`"
        class="btn btn-lg w-full"
      >
        <UiAppIcon :name="session.sport === 'velo' ? 'velo' : 'run'" :size="15" />
        {{ session.sport === 'velo' ? 'Rouler' : 'Courir' }}
      </NuxtLink>
      <UiActionButton v-else class="btn btn-lg w-full" :action="saveFeedback">
        Enregistrer le ressenti
      </UiActionButton>
    </div>
  </div>
</template>
