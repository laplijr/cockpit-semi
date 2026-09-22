<script setup lang="ts">
import { CURRENT_POSITION_LABEL } from '~~/server/domain/routes/route'
import { RouteRejection } from '~~/server/domain/routes/validate'

const props = withDefaults(
  defineProps<{
    sessionId: number
    distanceM: number
    /** Écran de départ : carte plus basse, et pas de GPX à télécharger là. */
    compact?: boolean
  }>(),
  { compact: false },
)

const emit = defineEmits<{ changed: [] }>()

/** Variante montrée : l'écran de départ la suit pour dessiner sa trace. */
const shown = defineModel<number>('shown', { default: 0 })

const { data, refresh } = await useFetch(() => `/api/sessions/${props.sessionId}/routes`)

const address = ref('')
const error = ref('')
const locating = ref(false)
const routing = useRoutingAvailable()

/**
 * Le champ suit l'origine de la boucle affichée et ne garde pas celle d'avant :
 * « Partir d'ici » remplace l'adresse pré-écrite au lieu de la laisser mentir
 * sur le point de départ. Une boucle partie d'une position n'a pas d'adresse à
 * reproposer — le champ redevient vide, et la ligne de tête dit d'où l'on part.
 */
watch(
  data,
  (loaded) => {
    const last = loaded?.routes[0]?.address
    address.value = last === CURRENT_POSITION_LABEL ? '' : (last ?? loaded?.homeAddress ?? '')
  },
  { immediate: true },
)

const routes = computed(() => data.value?.routes ?? [])
const variant = computed(() => routes.value[shown.value % Math.max(1, routes.value.length)])

/** D'où part la boucle affichée : une adresse, ou la position du jour. */
const origin = computed(() => variant.value?.address ?? '')

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

async function suggest(body: Record<string, unknown>) {
  error.value = ''
  try {
    await $fetch(`/api/sessions/${props.sessionId}/routes`, { method: 'POST', body })
    shown.value = 0
    await refresh()
    emit('changed')
  } catch (cause) {
    error.value = apiMessage(cause, 'Suggestion impossible.')
  }
}

const fromAddress = () => suggest({ address: address.value || null })

/**
 * Partir d'où l'on est (§ 9, P10.3) : la position de l'appareil remplace
 * l'adresse, et rien d'autre ne quitte le navigateur que ces coordonnées.
 */
async function fromHere() {
  error.value = ''
  locating.value = true
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
    )
    await suggest({ lat: position.coords.latitude, lon: position.coords.longitude })
  } catch {
    error.value = 'Position indisponible : autorise la localisation, ou tape une adresse.'
  } finally {
    locating.value = false
  }
}
</script>

<template>
  <!-- Sans clé et sans boucle déjà tracée, la tuile n'a rien à montrer (§ 9). -->
  <div v-if="routing || variant" class="tile bg-surface-inset">
    <div class="flex flex-wrap items-baseline gap-x-3">
      <span class="label text-[10.5px]">Itinéraire</span>
      <span class="mono min-w-0 text-[11.5px] text-text-dim">
        boucle de {{ formatDistance(distanceM) }}
        <template v-if="origin">· départ {{ origin }}</template>
      </span>
    </div>

    <!-- Une action principale par ligne : le bouton sert le champ d'à côté.
         « Partir d'ici » est la même action depuis une autre origine (P10.3). -->
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
        :action="fromAddress"
      >
        {{ routes.length > 0 ? 'Autre boucle' : 'Proposer' }}
      </UiActionButton>
      <UiActionButton
        class="btn btn-ghost shrink-0 self-stretch lean:self-auto"
        icon="target"
        :icon-size="15"
        :pending="locating"
        :action="fromHere"
      >
        Partir d'ici
      </UiActionButton>
    </div>

    <p v-if="error" class="text-[12px] text-warn">{{ error }}</p>

    <p v-else-if="!variant" class="text-[12px] text-text-dim">
      Aucune boucle proposée. L'adresse du profil est reprise par défaut.
    </p>

    <template v-else>
      <!-- La carte se charge côté navigateur : Leaflet a besoin d'un DOM. -->
      <ClientOnly>
        <UiRouteMap :points="variant.points" :height="compact ? 190 : 240" />
        <template #fallback>
          <UiSkeleton variant="block" :height="compact ? 190 : 240" class="rounded-md" />
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
            class="tap mono inline-flex items-center self-start text-[11.5px] text-text-dim hover:text-text"
            @click="shown = shown + 1"
          >
            Voir la variante suivante
          </button>
        </div>
      </div>

      <!-- Avant de partir, le GPX n'a personne à servir : la trace est déjà
           dans le téléphone qui la suit (§ 8, P10.3). -->
      <a
        v-if="!compact"
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
