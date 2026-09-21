<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Fond de carte OpenStreetMap avec la trace exacte par-dessus, point par point
 * (§ 8). Les tuiles sont éclaircies puis inversées en CSS : l'app est sombre,
 * et il n'existe pas de fond sombre chez OSM sans passer par un second tiers.
 * Aucune donnée d'entraînement ne part : le navigateur ne demande que des
 * tuiles, repérées par leur seule coordonnée.
 */
const props = withDefaults(
  defineProps<{
    points: { lat: number; lon: number }[]
    height?: number
    /** Trace à suivre, dessinée sous la trace principale (§ 9, P10). */
    guide?: { lat: number; lon: number }[]
    /** Position courante, pendant une sortie. */
    position?: { lat: number; lon: number } | null
  }>(),
  { height: 220, guide: undefined, position: null },
)

const container = ref<HTMLElement>()
let map: L.Map | undefined
let bounds: L.LatLngBounds | undefined
let observer: ResizeObserver | undefined

/**
 * Leaflet mesure son conteneur au moment où il se construit. Dans un dialog,
 * cette taille n'est pas encore la bonne : sans ce recadrage à chaque
 * redimensionnement, la boucle sort du cadre.
 */
function refit() {
  if (!map || !bounds) return
  map.invalidateSize()
  map.fitBounds(bounds, { padding: [16, 16] })
}

function draw() {
  const hasGuide = (props.guide?.length ?? 0) > 1
  if (!container.value || (props.points.length < 2 && !hasGuide)) return

  const latLngs = props.points.map((point) => [point.lat, point.lon] as [number, number])

  /*
   * Dans une feuille qui défile, le glissement d'un doigt appartient à la
   * feuille : laissé à Leaflet, il l'avale et la feuille se bloque sous le
   * pouce. Sur pointeur grossier la carte ne se déplace donc plus au doigt —
   * elle se pince pour zoomer et garde ses boutons + / − (§ 8, P6.8).
   */
  const coarse = window.matchMedia('(pointer: coarse)').matches

  map ??= L.map(container.value, {
    attributionControl: true,
    zoomControl: true,
    dragging: !coarse,
  })
  map.eachLayer((layer) => map!.removeLayer(layer))

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  /** La boucle proposée passe dessous, en gris : c'est un repère, pas la course. */
  if (props.guide && props.guide.length > 1) {
    L.polyline(
      props.guide.map((point) => [point.lat, point.lon] as [number, number]),
      { color: '#6d665c', weight: 3, opacity: 0.9 },
    ).addTo(map)
  }

  L.polyline(latLngs, { color: '#f2a23a', weight: 4, opacity: 0.95 }).addTo(map)
  /** Le départ est aussi l'arrivée : un seul repère suffit à s'orienter. */
  L.circleMarker(latLngs[0]!, {
    radius: 6,
    color: '#f2a23a',
    fillColor: '#161514',
    fillOpacity: 1,
    weight: 3,
  }).addTo(map)

  /** Le point courant se lit en blanc : c'est le seul repère qui bouge. */
  if (props.position) {
    L.circleMarker([props.position.lat, props.position.lon], {
      radius: 7,
      color: '#161514',
      fillColor: '#f3efe8',
      fillOpacity: 1,
      weight: 2,
    }).addTo(map)
  }

  bounds = L.latLngBounds([
    ...latLngs,
    ...(props.guide ?? []).map((p) => [p.lat, p.lon] as [number, number]),
  ])
  refit()
}

onMounted(() => {
  draw()
  observer = new ResizeObserver(refit)
  if (container.value) observer.observe(container.value)
})

watch([() => props.points, () => props.guide, () => props.position], draw, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = undefined
  map?.remove()
  map = undefined
  bounds = undefined
})
</script>

<template>
  <div
    v-if="points.length > 1 || (guide && guide.length > 1)"
    ref="container"
    class="route-map w-full rounded-md border border-line"
    :style="{ height: `${height}px` }"
  />

  <p v-else class="text-[12.5px] text-text-dim">
    Une trace demande au moins deux points pour se dessiner.
  </p>
</template>

<style>
/* Les tuiles claires d'OSM passent en sombre sans changer de fournisseur. */
.route-map .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.7);
}

.route-map {
  background: var(--color-surface-inset);
}

.route-map .leaflet-control-attribution {
  background: rgba(22, 21, 20, 0.75);
  color: var(--color-text-muted);
  font-size: 10px;
}

.route-map .leaflet-control-attribution a {
  color: var(--color-text-dim);
}

.route-map .leaflet-bar a {
  background: var(--color-surface);
  border-color: var(--color-line);
  color: var(--color-text-dim);
}

.route-map .leaflet-bar a:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
</style>
