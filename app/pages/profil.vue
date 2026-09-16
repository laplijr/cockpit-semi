<script setup lang="ts">
import {
  PROFILES_BY_LOAD,
  PROFILE_DESCRIPTIONS,
  PROFILE_LABELS,
  defaultsFor,
  type AthleteProfile,
} from '~~/server/domain/athlete/profile'

const { clear: clearSession } = useUserSession()
const { data: athlete, refresh } = await useFetch('/api/athlete')

const WEEKDAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
]

const form = reactive({
  firstName: athlete.value?.firstName ?? '',
  birthDate: athlete.value?.birthDate ?? '',
  profile: athlete.value?.profile ?? null,
  avatar: athlete.value?.avatar ?? null,
  weightKg: athlete.value?.weightKg ?? null,
  maxHr: athlete.value?.maxHr ?? null,
  availableDays: [...(athlete.value?.constraints?.availableDays ?? [])],
  longRunDay: athlete.value?.constraints?.longRunDay ?? 7,
  easyDays: [...(athlete.value?.constraints?.easyDays ?? [1])],
  runsPerWeek: athlete.value?.constraints?.runsPerWeek ?? null,
  startWeeklyVolumeM: athlete.value?.startWeeklyVolumeM ?? 20000,
  peakWeeklyVolumeM: athlete.value?.peakWeeklyVolumeM ?? 45000,
})

const saving = ref(false)
const saved = ref(false)
const photoError = ref('')

/** Valeurs avant application d'un profil, pour afficher l'ancienne barrée (§ 8). */
const replaced = ref<{ start: number; peak: number; runs: number | null } | null>(null)

const avatarSrc = computed(() => form.avatar ?? avatarDataUrl(form.firstName))

/**
 * Choisir un profil ne fait que pré-remplir : les trois champs restent
 * modifiables, et rien n'est écrit sans « Enregistrer » (§ 9, P5.7).
 */
function applyProfile(profile: AthleteProfile) {
  form.profile = profile
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

function toggle(list: number[], day: number) {
  const index = list.indexOf(day)
  if (index === -1) list.push(day)
  else list.splice(index, 1)
}

const canSave = computed(() => form.availableDays.length >= 3)

async function save() {
  saving.value = true
  saved.value = false
  try {
    await $fetch('/api/athlete', {
      method: 'PUT',
      body: {
        firstName: form.firstName.trim() || null,
        birthDate: form.birthDate || null,
        profile: form.profile,
        avatar: form.avatar,
        weightKg: form.weightKg,
        maxHr: form.maxHr,
        startWeeklyVolumeM: form.startWeeklyVolumeM,
        peakWeeklyVolumeM: form.peakWeeklyVolumeM,
        constraints: {
          availableDays: [...form.availableDays].sort((a, b) => a - b),
          longRunDay: form.longRunDay,
          easyDays: [...form.easyDays].sort((a, b) => a - b),
          ...(form.runsPerWeek ? { runsPerWeek: form.runsPerWeek } : {}),
        },
      },
    })
    await refresh()
    replaced.value = null
    saved.value = true
  } finally {
    saving.value = false
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex max-w-[860px] flex-col gap-4">
    <div v-if="!athlete?.onboarded" class="tile" style="border-color: rgba(242, 162, 58, 0.35)">
      <span class="label">Première configuration</span>
      <p class="text-[13px] text-text-dim">
        Ces contraintes déterminent la semaine type. Le plan se régénère à chaque enregistrement.
      </p>
    </div>

    <div class="tile">
      <span class="label">Identité</span>

      <div class="flex items-start gap-4">
        <img :src="avatarSrc" alt="" class="size-16 rounded-full" />
        <div class="flex flex-col gap-2">
          <label class="btn btn-ghost cursor-pointer">
            <input type="file" accept="image/*" class="hidden" @change="onPhoto" />
            {{ form.avatar ? 'Remplacer la photo' : 'Ajouter une photo' }}
          </label>
          <button
            v-if="form.avatar"
            type="button"
            class="text-left text-[12px] text-text-muted hover:text-text"
            @click="form.avatar = null"
          >
            Revenir aux initiales
          </button>
          <span v-if="photoError" class="text-[12px] text-warn">{{ photoError }}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Prénom</span>
          <input v-model="form.firstName" type="text" class="input" placeholder="Ronan" />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Date de naissance</span>
          <input v-model="form.birthDate" type="date" class="input mono" />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Poids (kg)</span>
          <input v-model.number="form.weightKg" type="number" step="0.1" class="input mono" />
        </label>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">FC max (bpm)</span>
          <input v-model.number="form.maxHr" type="number" class="input mono" />
          <span v-if="!form.maxHr && athlete?.suggestedMaxHr" class="text-[12px] text-text-muted">
            Estimée à {{ athlete.suggestedMaxHr }} pour ton âge, tant qu'elle n'est pas mesurée.
          </span>
        </label>
        <div v-if="athlete?.age !== null" class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Âge</span>
          <span class="mono text-[15px]">{{ athlete?.age }} ans</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-line-soft pt-3">
        <span class="label text-[10.5px]">Profil physique</span>
        <p class="text-[13px] text-text-muted">
          Il pré-remplit le volume, le pic et le nombre de courses, et borne la montée hebdomadaire.
          Tout reste modifiable ensuite.
        </p>
        <div class="flex flex-col gap-1">
          <button
            v-for="item in PROFILES_BY_LOAD"
            :key="item"
            type="button"
            class="flex items-baseline gap-3 rounded-md border px-3 py-2 text-left"
            :class="
              form.profile === item
                ? 'border-accent/45 bg-surface-raised'
                : 'border-line-soft hover:bg-surface-inset'
            "
            @click="applyProfile(item)"
          >
            <span class="text-[13px] font-semibold">{{ PROFILE_LABELS[item] }}</span>
            <span class="text-[12px] text-text-muted">{{ PROFILE_DESCRIPTIONS[item] }}</span>
            <span class="mono ml-auto text-[11.5px] text-text-muted">
              {{ Math.round(defaultsFor(item).startWeeklyVolumeM / 1000) }}–{{
                Math.round(defaultsFor(item).peakWeeklyVolumeM / 1000)
              }}
              km · +{{ defaultsFor(item).maxWeeklyIncreasePct }} %/sem
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="tile">
      <span class="label">Volume de course</span>
      <p class="text-[13px] text-text-muted">
        Le plan part du volume de départ, monte de
        {{ form.profile ? defaultsFor(form.profile).maxWeeklyIncreasePct : 10 }} % par semaine au
        maximum et plafonne au pic.
      </p>
      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">
            Volume de départ (m / semaine)
            <span v-if="replaced" class="mono text-text-muted line-through">
              {{ replaced.start }}
            </span>
          </span>
          <input
            v-model.number="form.startWeeklyVolumeM"
            type="number"
            step="1000"
            class="input mono"
          />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">
            Pic (m / semaine)
            <span v-if="replaced" class="mono text-text-muted line-through">
              {{ replaced.peak }}
            </span>
          </span>
          <input
            v-model.number="form.peakWeeklyVolumeM"
            type="number"
            step="1000"
            class="input mono"
          />
        </label>
      </div>
    </div>

    <div class="tile">
      <span class="label">Jours d'entraînement</span>
      <p class="text-[13px] text-text-muted">
        Coche les jours où tu peux courir. Les jours disponibles disent
        <em>où</em> courir, pas <em>combien</em> de fois.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="day in WEEKDAYS"
          :key="day.value"
          type="button"
          class="btn btn-ghost"
          :class="form.availableDays.includes(day.value) && 'border-accent bg-accent/15 text-text'"
          @click="toggle(form.availableDays, day.value)"
        >
          {{ day.label }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 border-t border-line-soft pt-3">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Jour de la sortie longue</span>
          <select v-model.number="form.longRunDay" class="input">
            <option v-for="day in WEEKDAYS" :key="day.value" :value="day.value">
              {{ day.label }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">
            Courses par semaine
            <span v-if="replaced?.runs" class="mono text-text-muted line-through">
              {{ replaced.runs }}
            </span>
          </span>
          <select v-model.number="form.runsPerWeek" class="input">
            <option :value="null">Au choix du plan selon la phase</option>
            <option v-for="count in [2, 3, 4, 5, 6]" :key="count" :value="count">
              {{ count }} courses
            </option>
          </select>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-4 border-t border-line-soft pt-3">
        <div class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Jours qui restent faciles</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="day in WEEKDAYS"
              :key="day.value"
              type="button"
              class="pill"
              :class="form.easyDays.includes(day.value) && 'bg-accent/15 text-text'"
              @click="toggle(form.easyDays, day.value)"
            >
              {{ day.label.slice(0, 3) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button type="button" class="btn btn-lg" :disabled="saving || !canSave" @click="save">
        Enregistrer et régénérer le plan
      </button>
      <span v-if="!canSave" class="text-[13px] text-text-muted">Choisis au moins trois jours.</span>
      <span v-else-if="saved" class="text-[13px] text-ok">Plan régénéré.</span>
      <button type="button" class="btn btn-ghost ml-auto" @click="logout">Se déconnecter</button>
    </div>
  </div>
</template>
