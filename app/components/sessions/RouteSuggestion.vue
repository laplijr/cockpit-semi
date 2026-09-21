<script setup lang="ts">
import { RouteRejection } from '~~/server/domain/routes/validate'

const props = defineProps<{ sessionId: number; distanceM: number }>()

const { data, refresh } = await useFetch(() => `/api/sessions/${props.sessionId}/routes`)

const address = ref('')
const error = ref('')
const routing = useRoutingAvailable()
/** Variante montrée : la mieux classée, jusqu'à ce qu'on en demande une autre. */
const shown = ref(0)

watchEffect(() => {
  address.value ||= data.value?.routes[0]?.address ?? data.value?.homeAddress ?? ''
})

const routes = computed(() => data.value?.routes ?? [])
const variant = computed(() => routes.value[shown.value % Math.max(1, routes.value.length)])

/** Écart à la distance de la séance, en toutes lettres plutôt qu'en pourcent. */
const gapLabel = computed(() => {
  const current = variant.value
  if (!current) return ''
  const gap = Math.round(current.distanceM - current.targetDistanceM)
  if (Math.abs(gap) < 100) return 'à la distance visée'
  return `${gap > 0 ? '+' : '−'} ${formatDistance(Math.abs(gap))} sur la cible`
})

const rejections = computed(() => variant.value?.rejections ?? [])
const offTarget = computed(
  () =>
    rejections.value.includes(RouteRejection.TooShort) ||
    rejections.value.includes(RouteRejection.TooLong),
)
/** Le relief se dit à côté du D+, pas dans la ligne de la distance. */
const hilly = computed(() => rejections.value.includes(RouteRejection.TooHilly))

async function suggest() {
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
  }
}
</script>

<template>
  <!-- Sans clé et sans boucle déjà tracée, la tuile n'a rien à montrer (§ 9). -->
  <div v-if="routing || variant" class="tile bg-surface-inset">
    <div class="flex items-baseline gap-3">
      <span class="label text-[10.5px]">Itinéraire</span>
      <span class="mono text-[11.5px] text-text-dim">
        boucle de {{ formatDistance(distanceM) }} au départ de l'adresse
      </span>
    </div>

    <!-- Une action principale par ligne : le bouton sert le champ d'à côté. -->
    <div v-if="routing" class="flex flex-col gap-2 lean:flex-row lean:items-end">
      <input
        v-model="address"
        class="input"
        placeholder="Adresse de départ"
        aria-label="Adresse de départ"
      />
      <UiActionButton
        class="btn shrink-0 self-stretch lean:self-auto"
        :disabled="address.length < 3"
        :action="suggest"
      >
        {{ routes.length > 0 ? 'Autre boucle' : 'Proposer' }}
      </UiActionButton>
    </div>

    <p v-if="error" class="text-[12px] text-warn">{{ error }}</p>

    <p v-else-if="!variant" class="text-[12px] text-text-dim">
      Aucune boucle proposée. L'adresse du profil est reprise par défaut.
    </p>

    <template v-else>
      <!-- La carte se charge côté navigateur : Leaflet a besoin d'un DOM. -->
      <ClientOnly>
        <UiRouteMap :points="variant.points" :height="240" />
        <template #fallback>
          <UiSkeleton variant="block" :height="240" class="rounded-md" />
        </template>
      </ClientOnly>

      <div class="flex items-center gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="mono flex items-baseline gap-2 text-[13px]">
            {{ formatDistance(variant.distanceM) }} · D+ {{ variant.elevationGainM }} m
            <span v-if="hilly" class="pill pill-warn text-[10px]">vallonnée</span>
          </span>
          <!-- Le service vise la distance sans la tenir : l'écart se dit. -->
          <span class="mono text-[11.5px]" :class="offTarget ? 'text-warn' : 'text-text-dim'">
            {{ gapLabel }} · {{ variant.turns }} virages · variante
            {{ (shown % routes.length) + 1 }} / {{ routes.length }}
          </span>
          <button
            v-if="routes.length > 1"
            type="button"
            class="mono self-start text-[11.5px] text-text-dim hover:text-text"
            @click="shown = shown + 1"
          >
            Voir la variante suivante
          </button>
        </div>
      </div>

      <a
        :href="`/api/routes/${variant.id}`"
        class="btn btn-ghost self-stretch lean:self-start"
        download
      >
        <UiAppIcon name="route" :size="15" />
        Télécharger le GPX
      </a>
    </template>
  </div>
</template>
