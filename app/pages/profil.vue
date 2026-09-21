<script setup lang="ts">
import { MIN_AVAILABLE_DAYS } from '~~/server/domain/athlete/onboarding'
import { defaultsFor, type AthleteProfile } from '~~/server/domain/athlete/profile'
import { Sport } from '~~/server/domain/shared/sport'

const { clear: clearSession } = useUserSession()
const ui = useUiStore()
const plan = usePlanStore()
const athleteStore = useAthleteStore()
const { data: athlete, refresh } = await useFetch('/api/athlete')

const DEFAULT_SPORTS = [Sport.Running, Sport.Cycling, Sport.Strength]

const form = reactive({
  firstName: athlete.value?.firstName ?? '',
  birthDate: athlete.value?.birthDate ?? '',
  profile: athlete.value?.profile ?? null,
  avatar: athlete.value?.avatar ?? null,
  weightKg: athlete.value?.weightKg ?? null,
  homeAddress: athlete.value?.homeAddress ?? '',
  maxHr: athlete.value?.maxHr ?? null,
  availableDays: [...(athlete.value?.constraints?.availableDays ?? [])],
  longRunDay: athlete.value?.constraints?.longRunDay ?? 7,
  easyDays: [...(athlete.value?.constraints?.easyDays ?? [1])],
  runsPerWeek: athlete.value?.constraints?.runsPerWeek ?? null,
  sports: [...(athlete.value?.constraints?.sports ?? DEFAULT_SPORTS)],
  startWeeklyVolumeM: athlete.value?.startWeeklyVolumeM ?? 20000,
  peakWeeklyVolumeM: athlete.value?.peakWeeklyVolumeM ?? 45000,
})

const saved = ref(false)
const photoError = ref('')

/** Valeurs avant application d'un profil, pour afficher l'ancienne barrée (§ 8). */
const replaced = ref<{ start: number; peak: number; runs: number | null } | null>(null)

const avatarSrc = computed(() => form.avatar ?? avatarDataUrl(form.firstName))

/**
 * Choisir un profil ne fait que pré-remplir : les trois champs restent
 * modifiables, et rien n'est écrit sans « Enregistrer » (§ 9, P5.7).
 */
function onProfileChosen(profile: AthleteProfile | null) {
  if (!profile) {
    replaced.value = null
    return
  }
  const defaults = defaultsFor(profile)

  replaced.value = {
    start: form.startWeeklyVolumeM,
    peak: form.peakWeeklyVolumeM,
    runs: form.runsPerWeek,
  }

  form.startWeeklyVolumeM = defaults.startWeeklyVolumeM
  form.peakWeeklyVolumeM = defaults.peakWeeklyVolumeM
  form.runsPerWeek = defaults.runsPerWeek
}

async function onPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  photoError.value = ''
  try {
    form.avatar = await toAvatarDataUrl(file)
  } catch (error) {
    photoError.value = error instanceof PhotoTooLargeError ? error.message : 'Photo illisible.'
  }
}

const canSave = computed(() => form.availableDays.length >= MIN_AVAILABLE_DAYS)

async function save() {
  saved.value = false
  await $fetch('/api/athlete', {
    method: 'PUT',
    body: {
      firstName: form.firstName.trim() || null,
      birthDate: form.birthDate || null,
      profile: form.profile,
      avatar: form.avatar,
      weightKg: form.weightKg,
      homeAddress: form.homeAddress.trim() || null,
      maxHr: form.maxHr,
      startWeeklyVolumeM: form.startWeeklyVolumeM,
      peakWeeklyVolumeM: form.peakWeeklyVolumeM,
      constraints: {
        availableDays: [...form.availableDays].sort((a, b) => a - b),
        longRunDay: form.longRunDay,
        easyDays: [...form.easyDays].sort((a, b) => a - b),
        sports: form.sports,
        ...(form.runsPerWeek ? { runsPerWeek: form.runsPerWeek } : {}),
      },
    },
  })
  await refresh()
  /** La navigation lit les sports déclarés : elle suit l'enregistrement (§ 9, P8.2). */
  await athleteStore.load()
  replaced.value = null
  saved.value = true
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <span class="label">Identité</span>

      <div class="flex items-start gap-4">
        <!-- La corbeille se découvre au survol comme au clavier : jamais une
             commande réservée à la souris. -->
        <div class="group relative size-16">
          <img :src="avatarSrc" alt="" class="size-16 rounded-full" />
          <button
            v-if="form.avatar"
            type="button"
            aria-label="Supprimer la photo"
            class="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full border border-line bg-surface text-text-dim opacity-0 group-hover:opacity-100 hover:text-text focus-visible:opacity-100"
            @click="form.avatar = null"
          >
            <UiAppIcon name="trash" :size="13" />
          </button>
        </div>
        <div class="flex flex-col gap-2">
          <label class="btn btn-ghost">
            <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
            {{ form.avatar ? 'Remplacer la photo' : 'Ajouter une photo' }}
          </label>
          <span v-if="photoError" class="text-[12px] text-warn">{{ photoError }}</span>
        </div>
      </div>

      <ProfilIdentityFields
        v-model:first-name="form.firstName"
        v-model:birth-date="form.birthDate"
        v-model:weight-kg="form.weightKg"
      />

      <div class="fold-3 grid gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">FC max (bpm)</span>
          <input v-model.number="form.maxHr" type="number" class="input mono" />
          <span v-if="!form.maxHr && athlete?.suggestedMaxHr" class="text-[12px] text-text-dim">
            Estimée à {{ athlete.suggestedMaxHr }} pour ton âge, tant qu'elle n'est pas mesurée.
          </span>
        </label>
        <div v-if="athlete?.age !== null" class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Âge</span>
          <span class="mono text-[15px]">{{ athlete?.age }} ans</span>
        </div>
        <!-- Point de départ des boucles proposées depuis une séance (§ 9, P5.5). -->
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Adresse de départ des sorties</span>
          <input
            v-model="form.homeAddress"
            type="text"
            class="input"
            placeholder="12 rue de la Paix, Vannes"
          />
        </label>
      </div>

      <div class="border-t border-line-soft pt-3">
        <ProfilLevelField v-model="form.profile" @chosen="onProfileChosen" />
      </div>
    </div>

    <div class="tile">
      <span class="label">Volume de course</span>
      <p class="text-[13px] text-text-dim">
        Le plan part du volume de départ, monte de
        {{ form.profile ? defaultsFor(form.profile).maxWeeklyIncreasePct : 10 }} % par semaine au
        maximum et plafonne au pic.
      </p>
      <ProfilVolumeFields
        v-model:start="form.startWeeklyVolumeM"
        v-model:peak="form.peakWeeklyVolumeM"
        :replaced="replaced"
      />
    </div>

    <div class="tile">
      <span class="label">Jours d'entraînement</span>
      <ProfilTrainingDaysFields
        v-model:available-days="form.availableDays"
        v-model:long-run-day="form.longRunDay"
        v-model:runs-per-week="form.runsPerWeek"
        :replaced-runs="replaced?.runs ?? null"
      />

      <div class="flex flex-col gap-[6px] border-t border-line-soft pt-3">
        <span class="label text-[10.5px]">
          <UiInfoHint term="joursFaciles">Jours qui restent faciles</UiInfoHint>
        </span>
        <ProfilWeekdayPicker v-model="form.easyDays" short />
      </div>
    </div>

    <div class="tile">
      <ProfilSportsField v-model="form.sports" />
    </div>

    <!-- Un rappel est un réglage d'appareil et non de compte : il vit avec
         les autres réglages, pas dans une page à lui (§ 8). -->
    <ProfilNoticesField />

    <!-- Déclarer une pause est une décision d'entraînement, au même titre que
         le volume ou les jours : elle vit ici et non dans le menu du compte
         (§ 8, P6.35). -->
    <div class="tile">
      <span class="label"><UiInfoHint term="douleur">Pause et blessure</UiInfoHint></span>

      <template v-if="plan.pause">
        <span class="flex items-baseline gap-3">
          <span class="display text-[24px] font-semibold">
            Jour {{ plan.pause.day }}
            <span class="text-text-dim">de pause</span>
          </span>
          <span v-if="plan.pause.zone" class="pill pill-warn ml-auto">{{ plan.pause.zone }}</span>
        </span>
        <span class="mono text-[12px] text-text-dim">
          Ouverte le {{ formatDate(plan.pause.startDate) }} · la reprise se marque depuis le
          cockpit.
        </span>
      </template>

      <template v-else>
        <span class="mono text-[12px] text-text-dim">Aucune pause en cours.</span>
        <button type="button" class="btn btn-ghost self-start" @click="ui.openPanel('pause')">
          <UiAppIcon name="pause" />
          Déclarer une pause
        </button>
      </template>
    </div>

    <div class="flex items-center gap-3">
      <UiActionButton class="btn btn-lg" :disabled="!canSave" :action="save">
        Enregistrer et régénérer le plan
      </UiActionButton>
      <span v-if="!canSave" class="text-[13px] text-text-dim">
        Choisis au moins {{ MIN_AVAILABLE_DAYS }} jours.
      </span>
      <span v-else-if="saved" class="text-[13px] text-ok">Plan régénéré.</span>
      <UiActionButton class="btn btn-ghost ml-auto" :action="logout">Se déconnecter</UiActionButton>
    </div>
  </div>
</template>
