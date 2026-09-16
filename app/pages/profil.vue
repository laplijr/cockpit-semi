<script setup lang="ts">
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
  weightKg: athlete.value?.weightKg ?? null,
  maxHr: athlete.value?.maxHr ?? null,
  availableDays: [...(athlete.value?.constraints?.availableDays ?? [])],
  longRunDay: athlete.value?.constraints?.longRunDay ?? 7,
  easyDays: [...(athlete.value?.constraints?.easyDays ?? [1])],
  startWeeklyVolumeM: athlete.value?.startWeeklyVolumeM ?? 20000,
  peakWeeklyVolumeM: athlete.value?.peakWeeklyVolumeM ?? 45000,
})

const saving = ref(false)
const saved = ref(false)

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
        weightKg: form.weightKg,
        maxHr: form.maxHr,
        startWeeklyVolumeM: form.startWeeklyVolumeM,
        peakWeeklyVolumeM: form.peakWeeklyVolumeM,
        constraints: {
          availableDays: [...form.availableDays].sort((a, b) => a - b),
          longRunDay: form.longRunDay,
          easyDays: [...form.easyDays].sort((a, b) => a - b),
        },
      },
    })
    await refresh()
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
      <span class="label">Profil</span>
      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Poids (kg)</span>
          <input v-model.number="form.weightKg" type="number" step="0.1" class="input mono" />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">FC max (bpm)</span>
          <input v-model.number="form.maxHr" type="number" class="input mono" />
        </label>
      </div>
    </div>

    <div class="tile">
      <span class="label">Volume de course</span>
      <p class="text-[13px] text-text-muted">
        Le plan part du volume de départ, monte de 10 % par semaine au maximum et plafonne au pic.
      </p>
      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Volume de départ (m / semaine)</span>
          <input
            v-model.number="form.startWeeklyVolumeM"
            type="number"
            step="1000"
            class="input mono"
          />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Pic (m / semaine)</span>
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
      <p class="text-[13px] text-text-muted">Coche les jours où tu peux courir.</p>
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
