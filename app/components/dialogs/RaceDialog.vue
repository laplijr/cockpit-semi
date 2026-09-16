<script setup lang="ts">
const props = defineProps<{ raceId: number }>()
const emit = defineEmits<{ changed: [] }>()

const { data: races } = await useFetch('/api/races')

const race = computed(() => (races.value ?? []).find((item) => item.id === props.raceId))

const DISTANCES = [
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: 'Semi-marathon', value: 21097.5 },
  { label: 'Marathon', value: 42195 },
]

const PRIORITY_MEANING: Record<string, string> = {
  A: 'Course principale : tout le cycle est construit pour elle.',
  B: 'Course secondaire : elle se court sur la forme de la course A.',
  C: 'Course test : elle remplace la séance clé de la semaine et recale le VDOT.',
}

function secondsToText(seconds: number | null): string {
  if (seconds === null) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function textToSeconds(text: string): number | null {
  const parts = text.trim().split(':').map(Number)
  if (parts.length < 2 || parts.some(Number.isNaN)) return null
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!
}

const form = reactive({
  name: race.value?.name ?? '',
  date: race.value?.date ?? '',
  distanceM: race.value?.distanceM ?? 21097.5,
  priority: race.value?.priority ?? 'A',
  objectiveMode: race.value?.objectiveMode ?? 'performance_max',
  objectiveText: secondsToText(race.value?.objectifS ?? null),
  elevationGainM: race.value?.elevationGainM ?? null,
  expectedTempC: race.value?.expectedTempC ?? null,
  notes: race.value?.notes ?? '',
})

/** Ancienne valeur, affichée barrée dès qu'un champ change (§ 8). */
const before = computed(() => race.value)

const changed = (field: keyof typeof form, current: unknown) =>
  before.value !== undefined && String(form[field] ?? '') !== String(current ?? '')

/** Les quatre champs qui pilotent la périodisation (§ 5). */
const regenerates = computed(
  () =>
    race.value !== undefined &&
    (form.date !== race.value.date ||
      form.distanceM !== race.value.distanceM ||
      form.priority !== race.value.priority ||
      form.objectiveMode !== race.value.objectiveMode),
)

const saving = ref(false)
const error = ref('')
const confirmingDelete = ref(false)

async function save() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/races/${props.raceId}`, {
      method: 'PUT',
      body: {
        name: form.name.trim(),
        date: form.date,
        distanceM: form.distanceM,
        priority: form.priority,
        objectiveMode: form.objectiveMode,
        objectifS: form.objectiveMode === 'temps' ? textToSeconds(form.objectiveText) : null,
        elevationGainM: form.elevationGainM,
        expectedTempC: form.expectedTempC,
        notes: form.notes.trim() || null,
      },
    })
    emit('changed')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  saving.value = true
  try {
    await $fetch(`/api/races/${props.raceId}`, { method: 'DELETE' })
    emit('changed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="race" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">{{ race.name }}</span>
      <span class="mono text-[11.5px] text-text-muted">{{ formatLongDate(race.date) }}</span>
      <span class="pill ml-auto"
        >{{ PRIORITY_MEANING[form.priority] ? '' : '' }}priorité {{ form.priority }}</span
      >
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Projection</span>
        <span class="mono text-[20px]">{{ formatDuration(race.projectionS) }}</span>
        <span v-if="race.projectionIsFloor" class="text-[12px] text-text-muted">
          calculée sur le plancher
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Écart à l'objectif</span>
        <span class="mono text-[20px]">{{ formatSignedDuration(race.gapS) }}</span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Jours restants</span>
        <span class="mono text-[20px]">{{
          daysUntil(race.date, new Date().toISOString().slice(0, 10))
        }}</span>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">
          Nom
          <span v-if="changed('name', race.name)" class="text-text-muted line-through">
            {{ race.name }}
          </span>
        </span>
        <input v-model="form.name" type="text" class="input" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">
          Date
          <span v-if="changed('date', race.date)" class="mono text-text-muted line-through">
            {{ formatDate(race.date) }}
          </span>
        </span>
        <input v-model="form.date" type="date" class="input mono" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">
          Distance
          <span
            v-if="changed('distanceM', race.distanceM)"
            class="mono text-text-muted line-through"
          >
            {{ formatDistance(race.distanceM) }}
          </span>
        </span>
        <select v-model.number="form.distanceM" class="input">
          <option v-for="option in DISTANCES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">
          Priorité
          <span v-if="changed('priority', race.priority)" class="text-text-muted line-through">
            {{ race.priority }}
          </span>
        </span>
        <select v-model="form.priority" class="input">
          <option value="A">A — course principale</option>
          <option value="B">B — course secondaire</option>
          <option value="C">C — course test</option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Objectif</span>
        <select v-model="form.objectiveMode" class="input">
          <option value="temps">Chrono cible</option>
          <option value="performance_max">Performance maximale</option>
        </select>
      </label>
      <label v-if="form.objectiveMode === 'temps'" class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Chrono visé (h:mm:ss)</span>
        <input
          ref="objectiveInput"
          v-model="form.objectiveText"
          type="text"
          class="input mono"
          placeholder="1:38:00"
        />
      </label>
      <label v-else class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">D+ (m)</span>
        <input v-model.number="form.elevationGainM" type="number" class="input mono" />
      </label>
    </div>

    <p class="text-[13px] text-text-muted">{{ PRIORITY_MEANING[form.priority] }}</p>

    <p v-if="regenerates" class="text-[13px] text-warn">
      Date, distance, priorité ou mode d'objectif : enregistrer régénérera le plan.
    </p>
    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <div class="flex items-center gap-3">
      <button type="button" class="btn btn-lg" :disabled="saving" @click="save">Enregistrer</button>

      <template v-if="confirmingDelete">
        <span class="ml-auto text-[13px] text-warn">Supprimer cette course ?</span>
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="remove">
          Oui, supprimer
        </button>
        <button type="button" class="btn btn-ghost" @click="confirmingDelete = false">
          Annuler
        </button>
      </template>
      <button
        v-else
        type="button"
        class="ml-auto text-[13px] text-text-muted hover:text-text"
        @click="confirmingDelete = true"
      >
        Supprimer la course
      </button>
    </div>
  </div>
</template>
