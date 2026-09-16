<script setup lang="ts">
const emit = defineEmits<{ declared: [] }>()

const plan = usePlanStore()

const TYPES = [
  { value: 'blessure', label: 'Blessure' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'voyage', label: 'Voyage' },
  { value: 'autre', label: 'Autre' },
]

const form = reactive({
  type: 'blessure',
  zone: '',
  painLevel: 0,
  estimatedEndDate: '',
  allowances: {
    running: false,
    cycling: true,
    upperBodyStrength: true,
    legStrength: false,
  },
  condition: '',
  notes: '',
})

const pending = ref(false)
const error = ref('')

const ALLOWANCE_LABELS: Record<keyof typeof form.allowances, string> = {
  running: 'Course à pied',
  cycling: 'Vélo',
  upperBodyStrength: 'Muscu haut du corps',
  legStrength: 'Muscu jambes',
}

async function declare() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/pause', {
      method: 'POST',
      body: {
        type: form.type,
        zone: form.zone.trim() || null,
        painLevel: form.painLevel || null,
        estimatedEndDate: form.estimatedEndDate || null,
        allowances: {
          ...form.allowances,
          conditions: form.condition.trim() ? [form.condition.trim()] : [],
        },
        watchZones: form.zone.trim() ? [form.zone.trim()] : [],
        notes: form.notes.trim() || null,
      },
    })
    await plan.load()
    emit('declared')
  } catch {
    error.value = 'Enregistrement impossible.'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Type</span>
        <select v-model="form.type" class="input">
          <option v-for="item in TYPES" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Zone</span>
        <input v-model="form.zone" type="text" class="input" placeholder="genou droit" />
      </label>
    </div>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Douleur — {{ form.painLevel }} / 10</span>
      <input
        v-model.number="form.painLevel"
        type="range"
        min="0"
        max="10"
        class="w-full accent-warn"
      />
    </div>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Reprise estimée</span>
      <input v-model="form.estimatedEndDate" type="date" class="input mono" />
      <span class="text-[12px] text-text-muted">
        Laisse vide si tu ne sais pas : le plan repart alors en semaines non datées, et les séances
        apparaissent quand tu marques la reprise.
      </span>
    </label>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Autorisé pendant la pause</span>
      <label
        v-for="(label, key) in ALLOWANCE_LABELS"
        :key="key"
        class="flex items-center gap-2 text-[13px]"
      >
        <input v-model="form.allowances[key]" type="checkbox" class="accent-accent" />
        <span>{{ label }}</span>
      </label>
    </div>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Condition</span>
      <input
        v-model="form.condition"
        type="text"
        class="input"
        placeholder="Vélo seulement si indolore"
      />
    </label>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Note</span>
      <input v-model="form.notes" type="text" class="input" placeholder="Ongle de pied cassé" />
    </label>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <button type="button" class="btn btn-lg" :disabled="pending" @click="declare">
      Déclarer la pause et régénérer le plan
    </button>
  </div>
</template>
