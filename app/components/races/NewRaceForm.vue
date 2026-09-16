<script setup lang="ts">
import type { LookupFields } from './RaceSearch.vue'

const props = defineProps<{ lookupId?: number | null; prefill?: LookupFields | null }>()
const emit = defineEmits<{ created: [] }>()

const DISTANCES = [
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: 'Semi-marathon', value: 21097.5 },
  { label: 'Marathon', value: 42195 },
]

const form = reactive({
  name: '',
  date: '',
  distanceM: 21097.5,
  priority: 'A',
  objectiveMode: 'temps',
  objectiveText: '',
  elevationGainM: null as number | null,
})

const saving = ref(false)
const error = ref('')

/** Un champ trouvé pré-remplit le formulaire ; il reste modifiable (§ 6). */
watch(
  () => props.prefill,
  (fields) => {
    if (!fields) return
    const name = fields.name?.value
    const date = fields.date?.value
    const distanceM = Number(fields.distanceM?.value)
    const elevation = Number(fields.elevationGainM?.value)

    if (name) form.name = name
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) form.date = date
    if (Number.isFinite(distanceM) && distanceM > 0) form.distanceM = distanceM
    if (Number.isFinite(elevation)) form.elevationGainM = Math.round(elevation)
  },
  { immediate: true },
)

/** « 1:38:00 » ou « 98:00 » → secondes. */
function parseObjective(text: string): number | null {
  const parts = text.trim().split(':').map(Number)
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return null
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!
}

const canSave = computed(() => form.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date))

async function save() {
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/races', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        date: form.date,
        distanceM: form.distanceM,
        priority: form.priority,
        objectiveMode: form.objectiveMode,
        objectifS: form.objectiveMode === 'temps' ? parseObjective(form.objectiveText) : null,
        elevationGainM: form.elevationGainM,
        lookupId: props.lookupId ?? null,
      },
    })
    emit('created')
  } catch {
    error.value = 'Enregistrement impossible. Vérifie la date et la distance.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Nom</span>
        <input v-model="form.name" type="text" class="input" placeholder="Semi de Paris" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Date</span>
        <input v-model="form.date" type="date" class="input mono" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Distance</span>
        <select v-model.number="form.distanceM" class="input">
          <option v-for="option in DISTANCES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Priorité</span>
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
        <input v-model="form.objectiveText" type="text" class="input mono" placeholder="1:38:00" />
      </label>
      <span v-else />
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">D+ (m)</span>
        <input v-model.number="form.elevationGainM" type="number" class="input mono" />
      </label>
    </div>

    <p v-if="form.objectiveMode === 'performance_max'" class="text-[13px] text-text-muted">
      Sans chrono cible, l'objectif affiché sera la projection du jour, à battre.
    </p>
    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <div class="flex items-center gap-3">
      <button type="button" class="btn btn-lg" :disabled="saving || !canSave" @click="save">
        Ajouter et régénérer le plan
      </button>
      <span class="text-[13px] text-text-muted">
        Chaque valeur reste modifiable avant l'enregistrement.
      </span>
    </div>
  </div>
</template>
