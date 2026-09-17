<script setup lang="ts">
const props = defineProps<{ sessionId: number; distanceM: number }>()

const { data, refresh } = await useFetch(() => `/api/sessions/${props.sessionId}/routes`)

const address = ref('')
const generating = ref(false)
const error = ref('')
/** Variante montrée : la mieux classée, jusqu'à ce qu'on en demande une autre. */
const shown = ref(0)

watchEffect(() => {
  address.value ||= data.value?.routes[0]?.address ?? data.value?.homeAddress ?? ''
})

const routes = computed(() => data.value?.routes ?? [])
const variant = computed(() => routes.value[shown.value % Math.max(1, routes.value.length)])

async function suggest() {
  generating.value = true
  error.value = ''
  try {
    await $fetch(`/api/sessions/${props.sessionId}/routes`, {
      method: 'POST',
      body: { address: address.value || null },
    })
    shown.value = 0
    await refresh()
  } catch (cause) {
    error.value = apiMessage(cause, 'Suggestion impossible.')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="tile bg-surface-inset">
    <div class="flex items-baseline gap-3">
      <span class="label text-[10.5px]">Itinéraire</span>
      <span class="mono text-[11.5px] text-text-muted">
        boucle de {{ formatDistance(distanceM) }} au départ de l'adresse
      </span>
    </div>

    <!-- Une action principale par ligne : le bouton sert le champ d'à côté. -->
    <div class="flex items-end gap-2">
      <input
        v-model="address"
        class="input"
        placeholder="Adresse de départ"
        aria-label="Adresse de départ"
      />
      <button
        type="button"
        class="btn shrink-0"
        :disabled="generating || address.length < 3"
        @click="suggest"
      >
        {{ routes.length > 0 ? 'Autre boucle' : 'Proposer' }}
      </button>
    </div>

    <p v-if="error" class="text-[12px] text-warn">{{ error }}</p>

    <p v-else-if="!variant" class="text-[12px] text-text-muted">
      Aucune boucle proposée. L'adresse du profil est reprise par défaut.
    </p>

    <template v-else>
      <div class="flex items-center gap-3">
        <svg viewBox="0 0 88 88" class="size-[88px] shrink-0 rounded-md bg-surface">
          <path
            :d="routePath(variant.points, 88, 88)"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>

        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="mono text-[13px]">
            {{ formatDistance(variant.distanceM) }} · D+ {{ variant.elevationGainM }} m
          </span>
          <span class="mono text-[11.5px] text-text-muted">
            {{ variant.turns }} virages · variante {{ (shown % routes.length) + 1 }} /
            {{ routes.length }}
          </span>
          <button
            v-if="routes.length > 1"
            type="button"
            class="mono self-start text-[11.5px] text-text-muted hover:text-text"
            @click="shown = shown + 1"
          >
            Voir la variante suivante
          </button>
        </div>
      </div>

      <a :href="`/api/routes/${variant.id}`" class="btn btn-ghost" download>
        <UiAppIcon name="route" :size="15" />
        Télécharger le GPX
      </a>
    </template>
  </div>
</template>
