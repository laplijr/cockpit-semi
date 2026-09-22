<script setup lang="ts">
/**
 * Une course déjà courue : six champs et rien d'autre (§ 9, P7.5). Ni
 * priorité, ni objectif, ni projection — une course passée ne structure rien.
 */
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
  elevationGainM: null as number | null,
  chrono: '',
  representative: true,
})

const error = ref('')

/** Le chrono se dit d'un seul tenant, comme à l'onboarding : « 1:42:17 ». */
const seconds = computed(() => chronoSeconds({ ...emptyFitnessStart(''), chrono: form.chrono }))

const canSave = computed(
  () => form.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && seconds.value,
)

async function save() {
  error.value = ''
  try {
    await $fetch('/api/races/past', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        date: form.date,
        distanceM: form.distanceM,
        elevationGainM: form.elevationGainM,
        resultatS: seconds.value,
        representative: form.representative,
      },
    })
    emit('created')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible. Vérifie la date et le chrono.')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Nom</span>
      <input v-model="form.name" type="text" class="input" placeholder="Semi de Vannes" />
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

    <!-- Cinq champs au pouce : le D+ sort de la feuille et se renseigne
         ensuite depuis la course (§ 8, P7.5). -->
    <label class="hidden flex-col gap-[6px] lean:flex">
      <span class="label text-[10.5px]">D+ (m)</span>
      <input v-model.number="form.elevationGainM" type="number" class="input mono" />
    </label>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Chrono</span>
      <input
        v-model="form.chrono"
        type="text"
        inputmode="numeric"
        class="input mono"
        placeholder="1:42:17"
      />
    </label>

    <label class="flex items-baseline gap-3">
      <input v-model="form.representative" type="checkbox" class="size-4" />
      <span class="flex flex-col gap-[2px]">
        <span class="text-[13px]">Ce chrono reflète ma forme</span>
        <span class="text-[12px] text-text-dim">
          Décoché, le chrono est enregistré sans toucher au VDOT.
        </span>
      </span>
    </label>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <UiActionButton
      class="btn btn-lg self-stretch lean:self-start"
      :disabled="!canSave"
      :action="save"
    >
      Enregistrer la course
    </UiActionButton>
  </div>
</template>
