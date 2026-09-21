<script setup lang="ts">
import {
  MIN_AVAILABLE_DAYS,
  ONBOARDING_STEPS,
  OnboardingStep,
  STEP_TITLES,
} from '~~/server/domain/athlete/onboarding'
import { defaultsFor, type AthleteProfile } from '~~/server/domain/athlete/profile'
import { Sport } from '~~/server/domain/shared/sport'

/** Hors coque : l'arrivant n'a encore rien à piloter (§ 8, P8.2). */
definePageMeta({ layout: false })

const athleteStore = useAthleteStore()
const { user } = useUserSession()

const { data: state } = await useFetch('/api/onboarding/state')

/**
 * L'identifiant choisi à la création du compte tient lieu de prénom : le
 * redemander à vide donnerait l'impression de se répéter. Il reste affiché et
 * modifiable — l'identifiant est en minuscules et sans accent, un prénom ne
 * l'est pas (§ 9, P8.4).
 */
const suggestedFirstName = computed(() => {
  const login = user.value?.login ?? ''
  return login ? login.charAt(0).toUpperCase() + login.slice(1) : ''
})
const { data: races, refresh: refreshRaces } = await useFetch('/api/races')

const step = ref<OnboardingStep>(
  state.value?.untouched ? OnboardingStep.Welcome : (state.value?.step ?? OnboardingStep.Welcome),
)

const form = reactive({
  firstName: athleteStore.athlete?.firstName ?? suggestedFirstName.value,
  birthDate: athleteStore.athlete?.birthDate ?? '',
  weightKg: athleteStore.athlete?.weightKg ?? null,
  profile: athleteStore.athlete?.profile ?? null,
  availableDays: [...(athleteStore.athlete?.constraints?.availableDays ?? [])],
  longRunDay: athleteStore.athlete?.constraints?.longRunDay ?? 7,
  runsPerWeek: athleteStore.athlete?.constraints?.runsPerWeek ?? null,
  sports: [...(athleteStore.athlete?.constraints?.sports ?? [Sport.Running])],
})

const fitness = ref<FitnessStartValue>(emptyFitnessStart(state.value!.today))

/** L'objectif se répond aussi par « aucune course » : c'est le cycle d'entretien (§ 5). */
const noRace = ref(false)

const saving = ref(false)
const error = ref('')

const hasRace = computed(() => (races.value ?? []).length > 0)

/** Trois réponses obligatoires, pas une de plus (§ 9, P8.2). */
const canAdvance = computed(() => {
  if (step.value === OnboardingStep.Fitness) return fitnessStartIsAnswered(fitness.value)
  if (step.value === OnboardingStep.Objective) return hasRace.value || noRace.value
  if (step.value === OnboardingStep.Schedule) return form.availableDays.length >= MIN_AVAILABLE_DAYS
  return true
})

const isLast = computed(() => step.value === OnboardingStep.Schedule)

function onLevelChosen(profile: AthleteProfile | null) {
  if (!profile) return
  form.runsPerWeek = defaultsFor(profile).runsPerWeek
}

/** Chaque étape écrit ses champs ; le plan n'est généré qu'une fois, à la fin. */
async function persist() {
  if (step.value === OnboardingStep.Identity) {
    await $fetch('/api/onboarding/step', {
      method: 'PUT',
      body: {
        firstName: form.firstName.trim() || null,
        birthDate: form.birthDate || null,
        weightKg: form.weightKg,
      },
    })
    return
  }

  if (step.value === OnboardingStep.Level) {
    const defaults = form.profile ? defaultsFor(form.profile) : null
    await $fetch('/api/onboarding/step', {
      method: 'PUT',
      body: {
        profile: form.profile,
        ...(defaults
          ? {
              startWeeklyVolumeM: defaults.startWeeklyVolumeM,
              peakWeeklyVolumeM: defaults.peakWeeklyVolumeM,
              maxWeeklyIncreasePct: defaults.maxWeeklyIncreasePct,
            }
          : {}),
      },
    })
    return
  }

  if (step.value === OnboardingStep.Fitness) {
    await $fetch('/api/onboarding/fitness', {
      method: 'POST',
      body: fitnessStartBody(fitness.value),
    })
    return
  }

  if (step.value === OnboardingStep.Schedule) {
    await $fetch('/api/onboarding/step', {
      method: 'PUT',
      body: {
        constraints: {
          availableDays: [...form.availableDays].sort((a, b) => a - b),
          longRunDay: form.longRunDay,
          sports: form.sports,
          ...(form.runsPerWeek ? { runsPerWeek: form.runsPerWeek } : {}),
        },
      },
    })
  }
}

async function next() {
  saving.value = true
  error.value = ''
  try {
    await persist()
    if (isLast.value) {
      await $fetch('/api/onboarding/complete', { method: 'POST' })
      await athleteStore.load()
      await navigateTo('/')
      return
    }
    step.value = (step.value + 1) as OnboardingStep
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  } finally {
    saving.value = false
  }
}

function back() {
  if (step.value > OnboardingStep.Welcome) step.value = (step.value - 1) as OnboardingStep
}

async function onRaceCreated() {
  await refreshRaces()
  noRace.value = false
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center px-4 py-8 lean:px-6 lean:py-12">
    <div class="flex w-full max-w-[720px] flex-col gap-5">
      <header class="flex flex-col gap-3">
        <span
          class="display flex items-center gap-[10px] text-xl font-bold tracking-[0.06em] uppercase"
        >
          <UiAppIcon name="logo" :size="20" class="text-accent" />
          Cockpit
        </span>

        <!-- La progression est un objet à axe : elle garde sa forme et ne se
             replie pas (§ 8). Six pas, celui en cours en accent. -->
        <div class="flex items-center gap-[6px]" role="presentation">
          <span
            v-for="item in ONBOARDING_STEPS"
            :key="item"
            class="h-[3px] flex-1 rounded-sm"
            :class="item <= step ? 'bg-accent' : 'bg-line'"
          />
        </div>
        <h1 class="display text-[24px] font-semibold">{{ STEP_TITLES[step] }}</h1>
      </header>

      <template v-if="step === OnboardingStep.Welcome">
        <div class="tile">
          <p class="text-[14px]">
            Ce cockpit construit ton plan de course à pied, semaine par semaine, et le recale sur ce
            que tu fais vraiment. Il ne t'impose rien : il propose, tu décides.
          </p>
          <p class="text-[14px]">
            Il est fait pour la course à pied. Le vélo et la musculation y tiennent le rôle de
            séances de soutien, posées autour des courses et jamais à leur place.
          </p>
          <p class="text-[14px]">
            Six questions suffisent pour démarrer. Trois demandent une réponse, les autres se
            passent et se complètent plus tard dans Profil.
          </p>
        </div>
      </template>

      <template v-else-if="step === OnboardingStep.Identity">
        <div class="tile">
          <ProfilIdentityFields
            v-model:first-name="form.firstName"
            v-model:birth-date="form.birthDate"
            v-model:weight-kg="form.weightKg"
          />
          <p class="text-[13px] text-text-dim">
            La photo et l'adresse de départ des sorties se règlent dans Profil, plus tard.
          </p>
        </div>
      </template>

      <template v-else-if="step === OnboardingStep.Level">
        <div class="tile">
          <ProfilLevelField v-model="form.profile" @chosen="onLevelChosen" />
        </div>
      </template>

      <template v-else-if="step === OnboardingStep.Fitness">
        <ProfilFitnessStartFields v-model="fitness" />
      </template>

      <template v-else-if="step === OnboardingStep.Objective">
        <div class="tile">
          <span class="label">Courses inscrites</span>
          <template v-if="hasRace">
            <span
              v-for="race in races ?? []"
              :key="race.id"
              class="flex items-baseline gap-3 text-[14px]"
            >
              <span>{{ race.name }}</span>
              <span class="mono text-[12px] text-text-dim">{{ formatDate(race.date) }}</span>
              <span class="mono ml-auto text-[12px] text-text-dim">
                {{ formatDistance(race.distanceM) }}
              </span>
            </span>
            <p class="text-[13px] text-text-dim">
              Les suivantes s'ajoutent depuis Courses, une fois le plan en route.
            </p>
          </template>
          <p v-else class="text-[13px] text-text-dim">
            Sans course, le plan tourne en cycle d'entretien : des blocs de quatre semaines qui
            entretiennent la forme, sans affûtage puisqu'il n'y a rien à préparer. Une course
            ajoutée plus tard reprend la main.
          </p>
          <button
            v-if="!hasRace"
            type="button"
            class="btn btn-ghost self-start"
            :class="noRace && 'border-accent bg-accent/15 text-text'"
            :aria-pressed="noRace"
            @click="noRace = !noRace"
          >
            Aucune course pour l'instant
          </button>
        </div>

        <div v-if="!hasRace && !noRace" class="tile">
          <span class="label">Ajouter une course</span>
          <RacesNewRaceWindow @created="onRaceCreated" />
        </div>
      </template>

      <template v-else>
        <div class="tile">
          <ProfilTrainingDaysFields
            v-model:available-days="form.availableDays"
            v-model:long-run-day="form.longRunDay"
            v-model:runs-per-week="form.runsPerWeek"
          />
        </div>
        <div class="tile">
          <ProfilSportsField v-model="form.sports" />
        </div>
      </template>

      <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

      <div class="flex items-center gap-3">
        <button
          v-if="step > OnboardingStep.Welcome"
          type="button"
          class="btn btn-ghost"
          @click="back"
        >
          Retour
        </button>
        <button
          type="button"
          class="btn btn-lg ml-auto"
          :disabled="saving || !canAdvance"
          @click="next"
        >
          {{ isLast ? 'Générer mon plan' : 'Continuer' }}
        </button>
      </div>

      <p
        v-if="step === OnboardingStep.Schedule && form.availableDays.length < MIN_AVAILABLE_DAYS"
        class="text-[13px] text-text-dim"
      >
        Choisis au moins {{ MIN_AVAILABLE_DAYS }} jours.
      </p>
    </div>
  </div>
</template>
