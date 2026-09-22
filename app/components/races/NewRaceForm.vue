<script setup lang="ts">
import type { LookupFields } from './RaceSearch.vue'
import type { ObjectiveLevelValues } from './ObjectiveFields.vue'

const props = defineProps<{ lookupId?: number | null; prefill?: LookupFields | null }>()
const emit = defineEmits<{ created: [] }>()

const { data: races } = await useFetch('/api/races')

const ui = useUiStore()
const plan = usePlanStore()

/** Le jour même compte comme à venir : c'est encore une course qu'on prépare. */
const isPast = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(form.date) && form.date < plan.today)

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
  elevationGainM: null as number | null,
})

const levels = ref<ObjectiveLevelValues>({ ambitionS: null, realisticS: null, floorS: null })

const error = ref('')

/** Meilleur résultat représentatif sur la distance choisie : la référence du mode record (§ 5). */
const recordS = computed(() => {
  const best = (races.value ?? [])
    .filter(
      (race) =>
        race.status === 'courue' &&
        race.representative &&
        race.resultatS !== null &&
        Math.abs(race.distanceM - form.distanceM) < 1,
    )
    .map((race) => race.resultatS!)
    .sort((a, b) => a - b)
  return best.at(0) ?? null
})

/** Le mode record retombe sur le chrono cible dès que la distance perd son record. */
watch(recordS, (value) => {
  if (value === null && form.objectiveMode === 'record') form.objectiveMode = 'temps'
})

/**
 * Projection de la course qu'on est en train de saisir : elle n'existe pas
 * encore en base, donc elle se demande sur ses champs (§ 9, P5.15).
 */
const proposed = ref<ObjectiveLevelValues | null>(null)

watchEffect(async () => {
  const query = {
    date: form.date,
    distanceM: form.distanceM,
    elevationGainM: form.elevationGainM,
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    proposed.value = null
    return
  }
  proposed.value = (await $fetch('/api/races/projection', { query })).proposedLevels
})

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

const canSave = computed(
  () => form.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !isPast.value,
)

async function save() {
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
        objectifAmbitionS: levels.value.ambitionS,
        objectifS: levels.value.realisticS,
        objectifPlancherS: levels.value.floorS,
        elevationGainM: form.elevationGainM,
        lookupId: props.lookupId ?? null,
      },
    })
    emit('created')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible. Vérifie la date et la distance.')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Sous-grille : un libellé sur deux lignes ne décale plus son champ. En
         une colonne il n'y a plus rien à aligner, et la sous-grille se dissout
         avec la grille qu'elle alignait (§ 8, P6.8). -->
    <div
      class="flex flex-col gap-[6px] lean:grid lean:grid-cols-2 lean:grid-rows-[auto_auto_auto_auto_auto_auto] lean:gap-x-3 lean:gap-y-[6px]"
    >
      <label class="flex flex-col gap-[6px] lean:row-span-2 lean:grid lean:grid-rows-subgrid">
        <span class="label text-[10.5px]">Nom</span>
        <input v-model="form.name" type="text" class="input" placeholder="Semi de Paris" />
      </label>
      <label class="flex flex-col gap-[6px] lean:row-span-2 lean:grid lean:grid-rows-subgrid">
        <span class="label text-[10.5px]">Date</span>
        <input v-model="form.date" type="date" class="input mono" :min="plan.today" />
      </label>
      <label class="flex flex-col gap-[6px] lean:row-span-2 lean:grid lean:grid-rows-subgrid">
        <span class="label text-[10.5px]">Distance</span>
        <select v-model.number="form.distanceM" class="input">
          <option v-for="option in DISTANCES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px] lean:row-span-2 lean:grid lean:grid-rows-subgrid">
        <span class="label text-[10.5px]">Priorité</span>
        <select v-model="form.priority" class="input">
          <option value="A">A — course principale</option>
          <option value="B">B — course secondaire</option>
          <option value="C">C — course test</option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px] lean:row-span-2 lean:grid lean:grid-rows-subgrid">
        <span class="label text-[10.5px]">D+ (m)</span>
        <input v-model.number="form.elevationGainM" type="number" class="input mono" />
      </label>
      <span class="hidden lean:block" />
    </div>

    <RacesObjectiveFields
      v-model:mode="form.objectiveMode"
      v-model:levels="levels"
      :proposed="proposed"
      :record-s="recordS"
    />

    <!-- Une date passée ne se refuse pas : elle renvoie vers l'autre porte,
         celle d'une course déjà courue (§ 9, P7.5). -->
    <p v-if="isPast" class="text-[13px] text-text-dim">
      Cette date est passée. Une course déjà courue s'enregistre ailleurs, avec son chrono :
      <button type="button" class="text-accent underline" @click="ui.openModal('course-passee')">
        enregistrer une course déjà courue
      </button>
      .
    </p>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <div class="flex items-center gap-3">
      <UiActionButton class="btn btn-lg" :disabled="!canSave" :action="save">
        Ajouter et régénérer le plan
      </UiActionButton>
      <span class="text-[13px] text-text-dim">
        Chaque valeur reste modifiable avant l'enregistrement.
      </span>
    </div>
  </div>
</template>
