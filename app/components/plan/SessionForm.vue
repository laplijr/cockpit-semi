<script setup lang="ts">
/**
 * Le formulaire des trois gestes : Ronan choisit le sport, le type et la
 * taille, et le moteur dit sous les champs ce que ça coûte à la semaine. Rien
 * n'y bloque — les seuls refus viennent du serveur et protègent la donnée,
 * jamais l'entraînement (§ 5, P6.43).
 */
const props = defineProps<{
  date: string
  sessionId?: number | null
  /** Taille et sport de la séance remplacée, quand il y en a une. */
  initial?: { sport?: string; code?: string; durationMin?: number }
}>()
const emit = defineEmits<{ saved: [] }>()

const RUN_CODES = ['EF', 'SL', 'seuil', 'VMA', 'allure_semi', 'cotes', 'progressif']
const CYCLE_CODES = ['Z2', 'SL_velo', 'force_cadence', 'sweet_spot']

/** Durée minimale d'une séance posée à la main, comme au serveur (§ 5). */
const MIN_MANUAL_MIN = 20

const replacing = computed(() => Boolean(props.sessionId))

const form = reactive({
  sport: props.initial?.sport === 'velo' ? 'velo' : 'course',
  code: props.initial?.sport === 'velo' ? 'Z2' : 'EF',
  durationMin: props.initial?.durationMin ?? 45,
  distanceKm: null as number | null,
})

const codes = computed(() => (form.sport === 'velo' ? CYCLE_CODES : RUN_CODES))

watch(
  () => form.sport,
  (sport) => {
    form.code = sport === 'velo' ? 'Z2' : 'EF'
    form.distanceKm = null
  },
)

/** La distance prime quand elle est saisie : la durée n'est qu'un raccourci. */
const draft = computed(() => ({
  sport: form.sport,
  code: form.code,
  ...(form.sport === 'course' && form.distanceKm
    ? { distanceM: Math.round(form.distanceKm * 1000) }
    : { durationMin: Math.max(MIN_MANUAL_MIN, form.durationMin) }),
}))

interface EditNotice {
  code: string
  text: string
}

interface EditPreview {
  ok: boolean
  refusal?: string
  impact?: {
    runBeforeM: number
    runAfterM: number
    targetRunM: number
    notices: EditNotice[]
  }
}

const preview = ref<EditPreview>()

/** L'aperçu se redemande à chaque changement : c'est le serveur qui compte. */
watchEffect(async () => {
  const body = {
    kind: replacing.value ? 'remplacer' : 'ajouter',
    date: props.date,
    sessionId: props.sessionId ?? undefined,
    draft: draft.value,
  }
  try {
    preview.value = await $fetch<EditPreview>('/api/plan/preview', { method: 'POST', body })
  } catch {
    preview.value = undefined
  }
})

const impact = computed(() => (preview.value?.ok ? preview.value.impact : undefined))

const error = ref('')

async function save() {
  error.value = ''
  try {
    if (replacing.value) {
      await $fetch(`/api/sessions/${props.sessionId}/edit`, { method: 'POST', body: draft.value })
    } else {
      await $fetch('/api/plan/sessions', {
        method: 'POST',
        body: { date: props.date, draft: draft.value },
      })
    }
    emit('saved')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid fold-3 gap-3">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Sport</span>
        <select v-model="form.sport" class="input">
          <option value="course">Course à pied</option>
          <option value="velo">Vélo</option>
        </select>
      </label>

      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Type</span>
        <select v-model="form.code" class="input">
          <option v-for="code in codes" :key="code" :value="code">
            {{ SESSION_LABELS[code] ?? code }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Durée (min)</span>
        <input
          v-model.number="form.durationMin"
          type="number"
          :min="MIN_MANUAL_MIN"
          class="input mono"
        />
      </label>
    </div>

    <label v-if="form.sport === 'course'" class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Ou une distance (km)</span>
      <input v-model.number="form.distanceKm" type="number" step="0.1" min="0" class="input mono" />
      <span class="text-[12px] text-text-dim">
        Laissée vide, la durée est lue en distance à ton allure d'endurance.
      </span>
    </label>

    <!-- Ce que ça coûte : le moteur dit, Ronan décide (§ 1, P6.43). -->
    <div v-if="impact" class="tile gap-2 bg-surface-inset py-3">
      <span class="label text-[10.5px]">Ce que ça change pour la semaine</span>
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="mono text-[13px] text-text-dim line-through">
          {{ formatDistance(impact.runBeforeM) }}
        </span>
        <span class="mono text-[13px] text-accent">{{ formatDistance(impact.runAfterM) }}</span>
        <span class="mono text-[11.5px] text-text-dim">
          de course, pour {{ formatDistance(impact.targetRunM) }} visés
        </span>
      </div>
      <span v-for="notice in impact.notices" :key="notice.code" class="text-[12px] text-warn">
        {{ notice.text }}
      </span>
    </div>

    <p v-else-if="preview && !preview.ok" class="text-[13px] text-warn">{{ preview.refusal }}</p>
    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <!-- Fantôme : la fenêtre garde le retour de séance comme action principale (§ 8). -->
    <UiActionButton class="btn btn-ghost self-stretch lean:self-start" :action="save">
      {{ replacing ? 'Remplacer la séance' : 'Ajouter la séance' }}
    </UiActionButton>
  </div>
</template>
