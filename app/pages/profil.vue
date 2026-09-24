<script setup lang="ts">
import { MIN_AVAILABLE_DAYS } from '~~/server/domain/athlete/onboarding'
import { defaultsFor, type AthleteProfile } from '~~/server/domain/athlete/profile'
import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'
import { Sport } from '~~/server/domain/shared/sport'
import { StrengthEquipment } from '~~/server/domain/strength/equipment'
import { StrengthIntent } from '~~/server/domain/strength/intent'

const { clear: clearSession } = useUserSession()
const ui = useUiStore()
const plan = usePlanStore()
const athleteStore = useAthleteStore()
/*
 * L'attente ne reste que côté serveur. Sur le client la navigation n'attend
 * plus la réponse ; à l'aller-retour serveur il n'y a aucune navigation à
 * délivrer, et les champs étant semés dans `setup`, une réponse absente à cet
 * instant peignait un formulaire vide dans le HTML.
 */
const athleteFetch = useFetch('/api/athlete', { lazy: import.meta.client })
if (import.meta.server) await athleteFetch

const { data: athlete, refresh } = athleteFetch

const DEFAULT_SPORTS = [Sport.Running, Sport.Cycling, Sport.Strength]

function seedFrom(one: typeof athlete.value) {
  return {
    firstName: one?.firstName ?? '',
    birthDate: one?.birthDate ?? '',
    profile: one?.profile ?? null,
    avatar: one?.avatar ?? null,
    weightKg: one?.weightKg ?? null,
    homeAddress: one?.homeAddress ?? '',
    maxHr: one?.maxHr ?? null,
    availableDays: [...(one?.constraints?.availableDays ?? [])],
    longRunDay: one?.constraints?.longRunDay ?? 7,
    easyDays: [...(one?.constraints?.easyDays ?? [1])],
    runsPerWeek: one?.constraints?.runsPerWeek ?? null,
    sports: [...(one?.constraints?.sports ?? DEFAULT_SPORTS)],
    strengthIntent: one?.constraints?.strengthIntent ?? StrengthIntent.Complete,
    equipment: one?.constraints?.equipment ?? StrengthEquipment.Gym,
    startWeeklyVolumeM: one?.startWeeklyVolumeM ?? 20000,
    peakWeeklyVolumeM: one?.peakWeeklyVolumeM ?? 45000,
  }
}

const form = reactive(seedFrom(athlete.value))

/**
 * Les champs ne sont plus remplis une fois pour toutes dans `setup` : la
 * réponse arrive après la page. Rien n'est écrasé sous les doigts — le
 * formulaire n'existe à l'écran qu'une fois la réponse là.
 */
watch(athlete, (one) => Object.assign(form, seedFrom(one)))

const saved = ref(false)
const photoError = ref('')

/**
 * Le point de départ se déclare aussi après l'onboarding : sans cette tuile,
 * un « je ne sais pas » ne se rattrapait plus (§ 9, P7.5).
 */
const { data: fitness, refresh: refreshFitness } = useFetch('/api/fitness', { lazy: true })

const declaring = ref(false)
/** Sans « je ne sais pas », le premier choix est le chrono : rien n'est vide. */
const declaration = ref<FitnessStartValue>({
  ...emptyFitnessStart(plan.today),
  kind: FitnessDeclaration.Chrono,
})
const declareError = ref('')

async function declare() {
  declareError.value = ''
  try {
    await $fetch('/api/fitness', {
      method: 'POST',
      body: { declaration: fitnessStartBody(declaration.value) },
    })
    declaring.value = false
    await Promise.all([refreshFitness(), plan.load()])
  } catch (failure) {
    declareError.value = apiMessage(failure, 'Déclaration refusée.')
  }
}

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
        strengthIntent: form.strengthIntent,
        equipment: form.equipment,
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
  <div v-if="athlete" class="flex flex-col gap-4">
    <div class="tile">
      <span class="label">Identité</span>

      <div class="flex items-start gap-4">
        <!-- La corbeille se découvre au survol comme au clavier au-dessus de
             la rupture ; au pouce il n'y a pas de survol, donc elle est
             visible et à 44 px (§ 8, P13). -->
        <div class="group relative size-16">
          <img :src="avatarSrc" alt="" class="size-16 rounded-full" />
          <button
            v-if="form.avatar"
            type="button"
            aria-label="Supprimer la photo"
            class="tap absolute -right-3 -bottom-3 grid size-11 place-items-center rounded-full border border-line bg-surface text-text-dim hover:text-text lean:-right-0 lean:-bottom-0 lean:size-6 lean:min-h-0 lean:min-w-0 lean:opacity-0 lean:group-hover:opacity-100 lean:focus-visible:opacity-100"
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
          <span v-if="photoError" class="text-meta text-warn">{{ photoError }}</span>
        </div>
      </div>

      <ProfilIdentityFields
        v-model:first-name="form.firstName"
        v-model:birth-date="form.birthDate"
        v-model:weight-kg="form.weightKg"
      />

      <div class="fold-3 grid gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-caption">FC max (bpm)</span>
          <input v-model.number="form.maxHr" type="number" class="input mono" />
          <span v-if="!form.maxHr && athlete?.suggestedMaxHr" class="text-meta text-text-dim">
            Estimée à {{ athlete.suggestedMaxHr }} pour ton âge, tant qu'elle n'est pas mesurée.
          </span>
        </label>
        <div v-if="athlete?.age !== null" class="flex flex-col gap-[6px]">
          <span class="label text-caption">Âge</span>
          <span class="mono text-copy">{{ athlete?.age }} ans</span>
        </div>
        <!-- Point de départ des boucles proposées depuis une séance (§ 9, P5.5). -->
        <label class="flex flex-col gap-[6px]">
          <span class="label text-caption">Adresse de départ des sorties</span>
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

    <!-- Le point de forme courant, dit en clair : l'absence devient visible
         au lieu d'être déductible (§ 9, P7.5). -->
    <div class="tile">
      <span class="label">Point de départ</span>

      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <template v-if="fitness?.point">
          <span class="display text-display-s font-semibold">
            {{ formatDecimal(fitness.point.vdot, 1) }}
          </span>
          <span class="pill">{{ fitness.point.isFloor ? 'plancher' : 'mesure' }}</span>
          <span class="mono text-meta text-text-dim">
            {{ FITNESS_ORIGIN_LABELS[fitness.point.origin ?? ''] ?? fitness.point.origin }} ·
            {{ formatDateWithYear(fitness.point.date) }}
          </span>
        </template>
        <span v-else class="text-body text-text-dim">— aucun point de forme</span>
      </div>

      <ProfilFitnessStartFields
        v-if="declaring"
        v-model="declaration"
        :allow-unknown="false"
        class="border-t border-line-soft pt-3"
      />
      <UiActionButton v-if="declaring" class="btn self-stretch lean:self-start" :action="declare">
        Enregistrer et régénérer le plan
      </UiActionButton>
      <button
        v-else
        type="button"
        class="btn btn-ghost self-stretch lean:self-start"
        @click="declaring = true"
      >
        Déclarer mon niveau
      </button>
      <p v-if="declareError" class="text-body text-warn">{{ declareError }}</p>
    </div>

    <div class="tile">
      <span class="label">Volume de course</span>
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
        <span class="label text-caption">
          <UiInfoHint term="joursFaciles">Jours qui restent faciles</UiInfoHint>
        </span>
        <ProfilWeekdayPicker v-model="form.easyDays" short />
      </div>
    </div>

    <div class="tile">
      <ProfilSportsField
        v-model="form.sports"
        v-model:intent="form.strengthIntent"
        v-model:equipment="form.equipment"
      />
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
          <span class="display text-display-s font-semibold">
            Jour {{ plan.pause.day }}
            <span class="text-text-dim">de pause</span>
          </span>
          <span v-if="plan.pause.zone" class="pill pill-warn ml-auto">{{ plan.pause.zone }}</span>
        </span>
        <span class="mono text-meta text-text-dim">
          Ouverte le {{ formatDate(plan.pause.startDate) }} · la reprise se marque depuis le
          cockpit.
        </span>
      </template>

      <template v-else>
        <span class="mono text-meta text-text-dim">Aucune pause en cours.</span>
        <button type="button" class="btn btn-ghost self-start" @click="ui.openPanel('pause')">
          <UiAppIcon name="pause" />
          Déclarer une pause
        </button>
      </template>
    </div>

    <!-- Deux boutons sur une ligne sortent par la droite à 390 px : sous la
         rupture la rangée devient une colonne, l'accent d'abord (§ 8, P7.4). -->
    <div class="flex flex-col gap-3 lean:flex-row lean:items-center">
      <UiActionButton class="btn btn-lg w-full lean:w-auto" :disabled="!canSave" :action="save">
        Enregistrer et régénérer le plan
      </UiActionButton>
      <span v-if="!canSave" class="text-body text-text-dim">
        Choisis au moins {{ MIN_AVAILABLE_DAYS }} jours.
      </span>
      <span v-else-if="saved" class="text-body text-ok">Plan régénéré.</span>
      <UiActionButton class="btn btn-ghost w-full lean:ml-auto lean:w-auto" :action="logout">
        Se déconnecter
      </UiActionButton>
    </div>
  </div>

  <UiPageSkeleton v-else :columns="2" :tiles="4" :lines="3" />
</template>
