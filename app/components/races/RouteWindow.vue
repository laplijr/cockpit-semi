<script setup lang="ts">
const props = defineProps<{ raceId: number }>()

const { data: races } = await useFetch('/api/races')
const { data: routes, refresh } = await useFetch(() => `/api/races/${props.raceId}/routes`)

const race = computed(() => (races.value ?? []).find((item) => item.id === props.raceId))

const address = ref('')
const arrivalDate = ref('')
const generating = ref(false)
const error = ref('')

watchEffect(() => {
  const current = race.value
  if (!current) return
  address.value ||= routes.value?.[0]?.address ?? ''
  arrivalDate.value ||= routes.value?.[0]?.date ?? isoDayBefore(current.date)
})

/** Une ligne par sortie ; les variantes d'une même sortie s'y empilent. */
const lines = computed(() => {
  const groups = new Map<string, NonNullable<typeof routes.value>>()
  for (const route of routes.value ?? []) {
    const key = `${route.date}-${route.sessionId ?? 'depart'}`
    groups.set(key, [...(groups.get(key) ?? []), route])
  }
  return [...groups.entries()].map(([key, variants]) => ({ key, variants }))
})

/** Variante affichée par ligne : la mieux classée, jusqu'à ce qu'on en demande une autre. */
const shown = ref<Record<string, number>>({})

function variantOf(line: { key: string; variants: NonNullable<typeof routes.value> }) {
  const index = (shown.value[line.key] ?? 0) % line.variants.length
  return line.variants[index]!
}

function nextVariant(key: string, count: number) {
  shown.value[key] = ((shown.value[key] ?? 0) + 1) % count
}

function titleOf(route: { code: string | null; date: string }) {
  const subject =
    route.code === null ? 'Logement → ligne de départ' : (SESSION_LABELS[route.code] ?? route.code)
  return `${subject} · ${formatDate(route.date)}`
}

async function generate() {
  generating.value = true
  error.value = ''
  try {
    await $fetch(`/api/races/${props.raceId}/routes`, {
      method: 'POST',
      body: { address: address.value, arrivalDate: arrivalDate.value || null },
    })
    shown.value = {}
    await refresh()
  } catch (cause) {
    error.value = apiMessage(cause, 'Génération impossible.')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div v-if="race" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">{{ race.name }}</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ formatDate(race.date) }} · {{ formatDistance(race.distanceM) }}
      </span>
    </div>

    <!-- Les trois champs partagent leurs lignes : un libellé long ne décale pas
         son voisin (§ 8, sous-grille). -->
    <div class="grid grid-cols-[2fr_1fr_auto] gap-4">
      <label class="grid grid-rows-subgrid gap-1 row-span-2">
        <span class="label text-[10.5px]">Adresse du logement</span>
        <input v-model="address" class="input" placeholder="12 calle Mayor, Madrid" />
      </label>
      <label class="grid grid-rows-subgrid gap-1 row-span-2">
        <span class="label text-[10.5px]">Arrivée sur place</span>
        <input v-model="arrivalDate" type="date" class="input" />
      </label>
      <div class="grid grid-rows-subgrid gap-1 row-span-2">
        <span class="label text-[10.5px]">&nbsp;</span>
        <button
          type="button"
          class="btn"
          :disabled="generating || address.length < 3"
          @click="generate"
        >
          {{ routes?.length ? 'Régénérer' : 'Générer' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <p v-else-if="lines.length === 0" class="text-[13px] text-text-muted">
      Aucun itinéraire. Saisis l'adresse du logement : une boucle sera tracée à la distance de
      chaque sortie prévue entre l'arrivée et la course.
    </p>

    <div
      v-for="line in lines"
      :key="line.key"
      class="flex items-center gap-4 border-t border-line-soft pt-3 first:border-t-0"
    >
      <svg viewBox="0 0 96 96" class="size-[96px] shrink-0 rounded-md bg-surface-inset">
        <path
          :d="routePath(variantOf(line).points, 96, 96)"
          fill="none"
          stroke="var(--color-accent)"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </svg>

      <div class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="display text-[17px] font-semibold">{{ titleOf(variantOf(line)) }}</span>
        <span class="mono text-[12px] text-text-dim">
          {{ formatDistance(variantOf(line).distanceM) }} · D+
          {{ variantOf(line).elevationGainM }} m · {{ variantOf(line).turns }} virages
        </span>
        <button
          v-if="line.variants.length > 1"
          type="button"
          class="mono self-start text-[11.5px] text-text-muted hover:text-text"
          @click="nextVariant(line.key, line.variants.length)"
        >
          Autre variante ({{ (shown[line.key] ?? 0) + 1 }} / {{ line.variants.length }})
        </button>
      </div>

      <a :href="`/api/routes/${variantOf(line).id}`" class="btn shrink-0" download>
        Télécharger le GPX
      </a>
    </div>
  </div>
</template>
