<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const props = defineProps<{ session: PlanSession; watchZones: string[] }>()
const emit = defineEmits<{ saved: [] }>()

const SENSATIONS = [
  { value: 'aisance', label: 'Aisance' },
  { value: 'jambes_fraiches', label: 'Jambes fraîches' },
  { value: 'jambes_lourdes', label: 'Jambes lourdes' },
  { value: 'essoufflement', label: 'Essoufflement' },
  { value: 'raideur', label: 'Raideur' },
  { value: 'nausee', label: 'Nausée' },
]

const isStrength = computed(() => props.session.sport === 'muscu')
const isRunning = computed(() => props.session.sport === 'course')
const strengthSets = ref<{ save: () => Promise<void> } | null>(null)

/** Durée prévue, déduite de la distance et de l'allure de la prescription. */
const plannedMinutes = computed(() => prescribedMinutes(props.session.prescription))

const form = reactive({
  rpe: props.session.prescription.expectedRpe,
  sensations: [] as string[],
  sleepHours: null as number | null,
  painZone: '',
  painIntensity: 0,
  durationMin: plannedMinutes.value,
  distanceM: props.session.prescription.totalDistanceM || null,
  notes: '',
})

const isTest = computed(() => props.session.code === 'test')
const testDistanceM = ref<number | null>(null)

const error = ref('')

function toggleSensation(value: string) {
  const index = form.sensations.indexOf(value)
  if (index === -1) form.sensations.push(value)
  else form.sensations.splice(index, 1)
}

async function save() {
  error.value = ''
  try {
    if (isStrength.value) await strengthSets.value?.save()

    if (isTest.value && testDistanceM.value) {
      await $fetch('/api/tests', {
        method: 'POST',
        body: { date: props.session.date, distanceM: testDistanceM.value },
      })
    }

    await $fetch(`/api/sessions/${props.session.id}/feedback`, {
      method: 'PUT',
      body: {
        rpe: form.rpe,
        sensations: form.sensations,
        sleepHours: form.sleepHours,
        pain: form.painZone ? { zone: form.painZone, intensity: form.painIntensity } : null,
        durationMin: form.durationMin,
        distanceM: form.distanceM,
        notes: form.notes || null,
      },
    })
    emit('saved')
  } catch {
    error.value = 'Enregistrement impossible.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Prévu</span>
      <span class="mono text-[13px] text-text-dim">
        <template v-if="isRunning">
          {{ formatDistance(session.prescription.totalDistanceM) }} ·
        </template>
        {{ plannedMinutes }} min · RPE {{ session.prescription.expectedRpe }}
      </span>
    </div>

    <div v-if="isTest" class="tile" style="border-color: rgba(242, 162, 58, 0.35)">
      <span class="label text-[10.5px]">
        <UiInfoHint term="test20">Distance couverte en 20 minutes (m)</UiInfoHint>
      </span>
      <input
        v-model.number="testDistanceM"
        type="number"
        inputmode="numeric"
        class="input mono"
        placeholder="4000"
      />
      <p class="text-[12px] text-text-dim">
        Cette distance devient ton VDOT courant et régénère le plan. Laisse vide si le test n'a pas
        été fait dans les conditions prévues.
      </p>
    </div>

    <div class="grid gap-3" :class="isRunning ? 'grid-cols-2' : 'grid-cols-1'">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Durée réelle (min)</span>
        <input
          v-model.number="form.durationMin"
          type="number"
          inputmode="numeric"
          class="input mono"
        />
      </label>
      <label v-if="isRunning" class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Distance réelle (m)</span>
        <input
          v-model.number="form.distanceM"
          type="number"
          inputmode="numeric"
          class="input mono"
        />
      </label>
    </div>

    <FeedbackStrengthSets v-if="isStrength" ref="strengthSets" :session="session" :rpe="form.rpe" />

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">
        <UiInfoHint term="rpe">Effort perçu</UiInfoHint> — RPE {{ form.rpe }}
      </span>
      <input v-model.number="form.rpe" type="range" min="1" max="10" class="w-full accent-accent" />
    </div>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]"><UiInfoHint term="sensations">Sensations</UiInfoHint></span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in SENSATIONS"
          :key="item.value"
          type="button"
          class="pill pill-tap"
          :class="form.sensations.includes(item.value) && 'bg-accent/15 text-text'"
          @click="toggleSensation(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">
        <UiInfoHint term="sommeil">Sommeil la nuit dernière (h)</UiInfoHint>
      </span>
      <input
        v-model.number="form.sleepHours"
        type="number"
        inputmode="decimal"
        step="0.5"
        class="input mono"
      />
    </label>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]"><UiInfoHint term="douleur">Douleur</UiInfoHint></span>
      <div v-if="watchZones.length > 0" class="flex flex-wrap gap-2">
        <button
          v-for="zone in watchZones"
          :key="zone"
          type="button"
          class="pill pill-tap pill-warn"
          :class="form.painZone === zone && 'ring-1 ring-warn'"
          @click="form.painZone = form.painZone === zone ? '' : zone"
        >
          {{ zone }}
        </button>
      </div>
      <input v-model="form.painZone" type="text" class="input" placeholder="Aucune douleur" />
      <div v-if="form.painZone" class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Intensité — {{ form.painIntensity }} / 10</span>
        <input
          v-model.number="form.painIntensity"
          type="range"
          min="0"
          max="10"
          class="w-full accent-warn"
        />
      </div>
    </div>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <!-- Une seule action principale, et elle reste sous le pouce : collée au
         bas de la feuille, elle ne demande pas de faire remonter le corps
         après le dernier champ (§ 8, P6.8). -->
    <UiActionButton class="btn btn-lg sticky bottom-0 lean:static" :action="save">
      Enregistrer le ressenti
    </UiActionButton>
  </div>
</template>
