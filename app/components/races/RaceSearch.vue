<script setup lang="ts">
export interface LookupField {
  value: string | null
  status: string
  sources: string[]
}

export type LookupFields = Record<string, LookupField>

const emit = defineEmits<{ found: [payload: { lookupId: number; fields: LookupFields }] }>()

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom officiel',
  date: 'Date',
  distanceM: 'Distance',
  location: 'Lieu',
  elevationGainM: 'Dénivelé positif',
  registration: 'Inscriptions',
}

const STATUS_LABELS: Record<string, string> = {
  sur: 'sûr',
  a_confirmer: 'à confirmer',
  estime: 'estimé',
}

const query = ref('')
const fields = ref<LookupFields | null>(null)
const pending = ref(false)
const error = ref('')
const llm = useLlmAvailable()

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function search() {
  pending.value = true
  error.value = ''
  try {
    const result = await $fetch<{ lookupId: number; fields: LookupFields }>('/api/races/lookup', {
      method: 'POST',
      body: { query: query.value.trim() },
    })
    fields.value = result.fields
    emit('found', result)
  } catch (failure) {
    error.value = `${apiMessage(failure, 'Recherche impossible.')} Remplis le formulaire à la main.`
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Sans clé, la recherche n'existe pas ; le formulaire de droite, si. -->
    <p v-if="!llm" class="text-[12px] text-text-dim">
      Recherche indisponible : la clé du modèle est absente. Remplis le formulaire à la main.
    </p>

    <template v-else>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Rechercher la course</span>
        <input
          v-model="query"
          type="text"
          class="input"
          placeholder="semi madrid 2027"
          @keydown.enter.prevent="search"
        />
      </label>

      <div>
        <button
          type="button"
          class="btn"
          :disabled="pending || query.trim().length < 3"
          @click="search"
        >
          {{ pending ? 'Recherche…' : 'Chercher' }}
        </button>
      </div>

      <p class="text-[12px] text-text-dim">
        Seul le nom tapé quitte le serveur. Chaque valeur trouvée reste modifiable à droite.
      </p>
      <p v-if="pending" class="text-[12px] text-text-dim">
        La recherche lit plusieurs sources : compte jusqu'à deux minutes.
      </p>
    </template>

    <div v-if="fields" class="flex flex-col gap-2 border-t border-line-soft pt-3">
      <div
        v-for="(label, key) in FIELD_LABELS"
        :key="key"
        class="flex flex-col gap-px border-t border-line-soft pt-2 first:border-t-0 first:pt-0"
      >
        <span class="flex items-baseline gap-2">
          <span class="label text-[10px]">{{ label }}</span>
          <span v-if="fields[key]" class="pill ml-auto text-[10px]">
            {{ STATUS_LABELS[fields[key]!.status] ?? fields[key]!.status }}
          </span>
        </span>
        <span class="mono text-[13px]">{{ fields[key]?.value ?? '—' }}</span>
        <span v-if="fields[key]?.sources.length" class="flex flex-wrap gap-2">
          <a
            v-for="source in fields[key]!.sources"
            :key="source"
            :href="source"
            target="_blank"
            rel="noreferrer"
            class="text-[11.5px] text-text-dim underline hover:text-text"
          >
            {{ hostOf(source) }}
          </a>
        </span>
      </div>
    </div>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>
  </div>
</template>
