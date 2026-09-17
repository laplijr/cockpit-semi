<script setup lang="ts">
import type { ObjectiveLevelValues } from '~/components/races/ObjectiveFields.vue'

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

const OBJECTIVE_LEVELS = [
  {
    key: 'ambition',
    label: 'Ambition',
    field: 'objectifAmbitionS',
    confidence: 'confidenceAmbitionPct',
  },
  { key: 'realiste', label: 'Réaliste', field: 'objectifS', confidence: 'confidencePct' },
  {
    key: 'plancher',
    label: 'Plancher',
    field: 'objectifPlancherS',
    confidence: 'confidencePlancherPct',
  },
] as const

const PRIORITY_MEANING: Record<string, string> = {
  A: 'Course principale : tout le cycle est construit pour elle.',
  B: 'Course secondaire : elle se court sur la forme de la course A.',
  C: 'Course test : elle remplace la séance clé de la semaine et recale le VDOT.',
}

const form = reactive({
  name: race.value?.name ?? '',
  date: race.value?.date ?? '',
  distanceM: race.value?.distanceM ?? 21097.5,
  priority: race.value?.priority ?? 'A',
  objectiveMode: (race.value?.objectiveMode ?? 'temps') as string,
  elevationGainM: race.value?.elevationGainM ?? null,
  expectedTempC: race.value?.expectedTempC ?? null,
  notes: race.value?.notes ?? '',
})

const levels = ref<ObjectiveLevelValues>({
  ambitionS: race.value?.objectifAmbitionS ?? null,
  realisticS: race.value?.objectifS ?? null,
  floorS: race.value?.objectifPlancherS ?? null,
})

/** Record sur la distance choisie : la référence du mode record (§ 5). */
const recordS = computed(() => {
  const best = (races.value ?? [])
    .filter(
      (item) =>
        item.status === 'courue' &&
        item.representative &&
        item.resultatS !== null &&
        Math.abs(item.distanceM - form.distanceM) < 1,
    )
    .map((item) => item.resultatS!)
    .sort((a, b) => a - b)
  return best.at(0) ?? null
})

watch(recordS, (value) => {
  if (value === null && form.objectiveMode === 'record') form.objectiveMode = 'temps'
})

/** La projection suit la distance et la date saisies, pas celles enregistrées. */
const proposed = ref<ObjectiveLevelValues | null>(race.value?.proposedLevels ?? null)

watchEffect(async () => {
  const query = {
    date: form.date,
    distanceM: form.distanceM,
    elevationGainM: form.elevationGainM,
    expectedTempC: form.expectedTempC,
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    proposed.value = null
    return
  }
  proposed.value = (await $fetch('/api/races/projection', { query })).proposedLevels
})

/** Ancienne valeur, affichée barrée dès qu'un champ change (§ 8). */
const before = computed(() => race.value)

const changed = (field: keyof typeof form, current: unknown) =>
  before.value !== undefined && String(form[field] ?? '') !== String(current ?? '')

/** Les trois champs qui pilotent la périodisation (§ 5, P5.15). */
const regenerates = computed(
  () =>
    race.value !== undefined &&
    (form.date !== race.value.date ||
      form.distanceM !== race.value.distanceM ||
      form.priority !== race.value.priority),
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
        objectifAmbitionS: levels.value.ambitionS,
        objectifS: levels.value.realisticS,
        objectifPlancherS: levels.value.floorS,
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
        <span class="label text-[10.5px]">D+ (m)</span>
        <input v-model.number="form.elevationGainM" type="number" class="input mono" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Température attendue (°C)</span>
        <input v-model.number="form.expectedTempC" type="number" class="input mono" />
      </label>
    </div>

    <RacesObjectiveFields
      v-model:mode="form.objectiveMode"
      v-model:levels="levels"
      :proposed="proposed"
      :record-s="recordS"
    />

    <!-- Les trois niveaux se lisent comme un curseur de risque, pas comme trois verdicts. -->
    <div v-if="race.objectiveMode === 'record'" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Record à battre <UiInfoHint term="confiance" /></span>
      <span class="mono text-[17px]">{{ formatDuration(race.recordS) }}</span>
      <span class="text-[12px] text-text-muted">
        {{ race.recordName }} · {{ race.recordDate ? formatDate(race.recordDate) : '—' }} ·
        confiance {{ race.confidencePct === null ? '—' : `${race.confidencePct} %` }}
      </span>
    </div>
    <div v-else-if="!race.objectiveToSet" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">
        Confiance par niveau <UiInfoHint term="confiance" />
      </span>
      <div class="grid grid-cols-3 gap-4">
        <div v-for="level in OBJECTIVE_LEVELS" :key="level.key" class="flex flex-col">
          <span class="label text-[10px]">{{ level.label }}</span>
          <span class="mono text-[17px]">{{ formatDuration(race[level.field]) }}</span>
          <span class="mono text-[12px] text-text-muted">
            {{ race[level.confidence] === null ? '—' : `${race[level.confidence]} %` }}
          </span>
        </div>
      </div>
      <span class="text-[12px] text-text-muted">
        Du plus ambitieux au plus sûr : la confiance monte avec le temps qu'on s'accorde.
      </span>
    </div>

    <p class="text-[13px] text-text-muted">{{ PRIORITY_MEANING[form.priority] }}</p>

    <p v-if="regenerates" class="text-[13px] text-warn">
      Date, distance ou priorité : enregistrer régénérera le plan.
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
