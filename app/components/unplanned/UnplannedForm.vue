<script setup lang="ts">
const emit = defineEmits<{ confirmed: [] }>()

interface UnplannedActivity {
  kind: 'activity'
  sport: string
  date: string
  durationMin: number
  rpeEstimate: number
  intensityProfile: string
  label: string
}

interface UnplannedUnavailability {
  kind: 'unavailability'
  from: string
  to: string
  scope: string
  label: string
}

type UnplannedEvent = UnplannedActivity | UnplannedUnavailability

const SCOPE_LABELS: Record<string, string> = {
  tout: 'Tout',
  course: 'Course à pied',
  velo: 'Vélo',
  muscu: 'Renforcement',
}

const text = ref('')
const draftId = ref<number | null>(null)
const events = ref<UnplannedEvent[]>([])
/**
 * Exception à la règle du § 8 : le libellé se réécrit. L'attente dure des
 * secondes et le mot nomme ce qui se passe ; ailleurs, le dessin suffit.
 */
const pending = ref(false)
const error = ref('')

const isActivity = (item: UnplannedEvent): item is UnplannedActivity => item.kind === 'activity'

async function interpret() {
  pending.value = true
  error.value = ''
  try {
    const result = await $fetch<{ id: number; events: UnplannedEvent[] }>('/api/unplanned', {
      method: 'POST',
      body: { text: text.value },
    })
    draftId.value = result.id
    events.value = result.events
    if (result.events.length === 0) {
      error.value = "Rien d'exploitable dans ce texte. Reformule, ou saisis la séance à la main."
    }
  } catch (failure) {
    error.value = apiMessage(failure, 'Lecture impossible.')
  } finally {
    pending.value = false
  }
}

async function confirm() {
  if (draftId.value === null) return
  pending.value = true
  error.value = ''
  try {
    await $fetch(`/api/unplanned/${draftId.value}/confirm`, {
      method: 'POST',
      body: { events: events.value },
    })
    emit('confirmed')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  } finally {
    pending.value = false
  }
}

function remove(index: number) {
  events.value.splice(index, 1)
}

/**
 * L'imprévu se déclare quand il arrive, souvent d'une main : le champ prend le
 * focus à l'ouverture, donc le clavier est déjà là (§ 8, P6.8). Le `nextTick`
 * n'est pas de la précaution — sans lui, le panneau hôte reprend le focus
 * après, son `onMounted` s'exécutant une fois celui de ses enfants passé.
 */
const field = useTemplateRef<HTMLTextAreaElement>('field')

onMounted(async () => {
  await nextTick()
  field.value?.focus()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Ce qui s'est passé</span>
      <textarea
        ref="field"
        v-model="text"
        rows="3"
        class="input h-auto py-2"
        placeholder="1 h de squash ce midi, pas dispo vendredi"
      />
    </label>

    <p class="text-[12px] text-text-dim">
      Seules la date du jour et tes séances prévues accompagnent ce texte.
    </p>

    <div v-if="draftId === null">
      <UiActionButton class="btn btn-lg" :disabled="text.trim().length < 3" :action="interpret">
        {{ pending ? 'Lecture…' : 'Lire le texte' }}
      </UiActionButton>
    </div>

    <template v-if="events.length > 0">
      <div class="flex flex-col gap-2">
        <span class="label text-[10.5px]">Ce que le cockpit a compris</span>

        <div v-for="(item, index) in events" :key="index" class="tile gap-2 bg-surface-inset py-3">
          <div class="flex items-baseline gap-2">
            <UiAppIcon
              :name="isActivity(item) ? sportStyle(item.sport).icon : 'pause'"
              :size="15"
              :class="isActivity(item) ? sportStyle(item.sport).tone : 'text-warn'"
            />
            <span class="display text-[16px] font-semibold">{{ item.label }}</span>
            <button
              type="button"
              class="tap ml-auto inline-flex items-center justify-center text-text-dim hover:text-text"
              aria-label="Retirer"
              @click="remove(index)"
            >
              <UiAppIcon name="close" :size="14" />
            </button>
          </div>

          <div v-if="isActivity(item)" class="grid grid-cols-1 gap-2 lean:grid-cols-3">
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">Date</span>
              <input v-model="item.date" type="date" class="input mono" />
            </label>
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">Durée (min)</span>
              <input
                v-model.number="item.durationMin"
                type="number"
                inputmode="numeric"
                min="1"
                class="input mono"
              />
            </label>
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">RPE</span>
              <input
                v-model.number="item.rpeEstimate"
                type="number"
                inputmode="numeric"
                min="1"
                max="10"
                class="input mono"
              />
            </label>
          </div>

          <div v-else class="grid grid-cols-1 gap-2 lean:grid-cols-3">
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">Du</span>
              <input v-model="item.from" type="date" class="input mono" />
            </label>
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">Au</span>
              <input v-model="item.to" type="date" class="input mono" />
            </label>
            <label class="flex flex-col gap-[4px]">
              <span class="label text-[10px]">Portée</span>
              <select v-model="item.scope" class="input">
                <option v-for="(label, value) in SCOPE_LABELS" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <UiActionButton class="btn btn-lg" :action="confirm">Confirmer</UiActionButton>
    </template>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>
  </div>
</template>
