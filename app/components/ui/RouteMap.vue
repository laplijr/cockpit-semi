<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Fond de carte OpenStreetMap avec la trace exacte par-dessus, point par point
 * (§ 8). Les tuiles sont éclaircies puis inversées en CSS : l'app est sombre,
 * et il n'existe pas de fond sombre chez OSM sans passer par un second tiers.
 * Aucune donnée d'entraînement ne part : le navigateur ne demande que des
 * tuiles, repérées par leur seule coordonnée.
 *
 * Les couches se construisent une fois et ne bougent plus : un relevé GPS ne
 * fait que rallonger la trace et déplacer le point courant (§ 9, P18). Jeter
 * les couches à chaque relevé rechargeait toutes les tuiles — la carte
 * clignotait une fois par seconde — et recadrer défaisait le zoom choisi.
 */
const props = withDefaults(
  defineProps<{
    points: { lat: number; lon: number }[]
    height?: number
    /** Trace à suivre, dessinée sous la trace principale (§ 9, P10). */
    guide?: { lat: number; lon: number }[]
    /** Position courante, pendant une sortie. */
    position?: { lat: number; lon: number } | null
    /** Plein cadre : la carte est le fond de l'écran de course (§ 9, P18). */
    fill?: boolean
  }>(),
  { height: 220, guide: undefined, position: null, fill: false },
)

/** Vrai dès que le doigt a glissé la carte : elle ne suit plus le coureur. */
const emit = defineEmits<{ adrift: [boolean] }>()

const container = ref<HTMLElement>()
let map: L.Map | undefined
let guideLine: L.Polyline | undefined
let trackLine: L.Polyline | undefined
let startMark: L.CircleMarker | undefined
let hereMark: L.CircleMarker | undefined
let observer: ResizeObserver | undefined

/**
 * Vrai tant que la carte garde le coureur au centre. Seul un glissement du
 * doigt l'arrête — un zoom non —, et seul « Recentrer » la relance.
 */
let following = true
/** Le premier cadrage se pose une fois ; ensuite le zoom appartient au doigt. */
let framed = false

/** Zoom de départ quand rien n'est encore tracé : l'échelle du pâté de maisons. */
const START_ZOOM = 16

/** Vue d'attente, le temps qu'un relevé arrive : elle ne se voit jamais. */
const FRANCE: [number, number] = [46.6, 2.5]
const COUNTRY_ZOOM = 5

function latLngs(points: { lat: number; lon: number }[]): [number, number][] {
  return points.map((point) => [point.lat, point.lon] as [number, number])
}

function frame(): L.LatLngBounds | undefined {
  const all = [...latLngs(props.points), ...latLngs(props.guide ?? [])]
  return all.length > 1 ? L.latLngBounds(all) : undefined
}

function ensureMap(): L.Map | undefined {
  if (map || !container.value) return map

  /*
   * Dans une feuille qui défile, le glissement d'un doigt appartient à la
   * feuille : laissé à Leaflet, il l'avale et la feuille se bloque sous le
   * pouce. Sur pointeur grossier la carte ne s'y déplace donc pas au doigt —
   * elle se pince pour zoomer et garde ses boutons + / − (§ 8, P6.8). Plein
   * cadre, il n'y a pas de feuille au-dessous : le doigt déplace la carte.
   */
  const coarse = window.matchMedia('(pointer: coarse)').matches

  /*
   * Plein cadre, le zoom se fait autour du centre et non sous les doigts :
   * pincer ne déplace pas la carte, le coureur reste au milieu.
   */
  const zoomAround = props.fill ? 'center' : true

  map = L.map(container.value, {
    attributionControl: true,
    zoomControl: !props.fill,
    dragging: props.fill || !coarse,
    touchZoom: zoomAround,
    scrollWheelZoom: zoomAround,
    doubleClickZoom: zoomAround,
  })

  /**
   * Une couche posée sur une carte sans centre jette « Set map center and zoom
   * first » : la vue se pose avant, même approximative — `reframe` l'ajuste
   * juste après.
   */
  const bounds = frame()
  const here = props.position
  if (bounds) map.fitBounds(bounds, { padding: [16, 16], animate: false })
  else if (here) map.setView([here.lat, here.lon], START_ZOOM, { animate: false })
  else map.setView(FRANCE, COUNTRY_ZOOM, { animate: false })

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  /** La boucle proposée passe dessous, en gris : c'est un repère, pas la course. */
  guideLine = L.polyline([], { color: '#6d665c', weight: 3, opacity: 0.9 }).addTo(map)
  trackLine = L.polyline([], { color: '#f2a23a', weight: 4, opacity: 0.95 }).addTo(map)

  /** `dragstart` ne vient que du doigt : un recadrage de l'écran ne le lève pas. */
  map.on('dragstart', () => {
    if (!following) return
    following = false
    emit('adrift', true)
  })

  return map
}

function drawTrack() {
  const current = ensureMap()
  if (!current) return

  const track = latLngs(props.points)
  const guide = latLngs(props.guide ?? [])

  guideLine?.setLatLngs(guide)
  trackLine?.setLatLngs(track)

  /** Le départ est aussi l'arrivée : un seul repère suffit à s'orienter. */
  const start = track[0]
  if (start && !startMark) {
    startMark = L.circleMarker(start, {
      radius: 6,
      color: '#f2a23a',
      fillColor: '#161514',
      fillOpacity: 1,
      weight: 3,
    }).addTo(current)
  } else if (start) {
    startMark?.setLatLng(start)
  }
}

function drawPosition() {
  const current = ensureMap()
  if (!current || !props.position) return

  const here = L.latLng(props.position.lat, props.position.lon)

  /** Le point courant se lit en blanc : c'est le seul repère qui bouge. */
  if (hereMark) hereMark.setLatLng(here)
  else {
    hereMark = L.circleMarker(here, {
      radius: 7,
      color: '#161514',
      fillColor: '#f3efe8',
      fillOpacity: 1,
      weight: 2,
    }).addTo(current)
  }

  /** Suivre, ce n'est pas recadrer : le coureur revient au centre, le zoom reste celui du doigt. */
  if (following) current.panTo(here, { animate: false })
}

/**
 * Cadrage. Une trace figée — un bilan, une boucle proposée — se recadre à
 * chaque changement : rien ne la suit, et passer d'une boucle à l'autre doit
 * montrer la nouvelle. Une sortie en cours, elle, ne se cadre qu'une fois :
 * ensuite la carte suit le coureur, et le zoom appartient au doigt.
 */
function reframe() {
  const current = ensureMap()
  if (!current) return

  const bounds = frame()
  const here = props.position

  if (!here) {
    if (bounds) current.fitBounds(bounds, { padding: [16, 16], animate: false })
    return
  }

  if (framed) return

  if (bounds) current.fitBounds(bounds, { padding: [16, 16], animate: false })
  else current.setView([here.lat, here.lon], START_ZOOM, { animate: false })

  framed = true
}

/** Revenir sur le coureur, et le suivre à nouveau (§ 9, P18). */
function recenter() {
  const current = ensureMap()
  if (!current) return

  following = true
  emit('adrift', false)

  const here = props.position
  if (here) {
    current.setView([here.lat, here.lon], current.getZoom(), { animate: false })
    return
  }

  const bounds = frame()
  if (bounds) current.fitBounds(bounds, { padding: [16, 16], animate: false })
}

defineExpose({ recenter })

/*
 * Le cadrage passe avant le point courant : il pose le zoom de départ, puis le
 * suivi ramène le coureur au centre dès le premier relevé.
 */
onMounted(() => {
  drawTrack()
  reframe()
  drawPosition()

  /**
   * Leaflet mesure son conteneur au moment où il se construit. Dans un dialog,
   * cette taille n'est pas encore la bonne : sans ce recalcul à chaque
   * redimensionnement, la carte ne remplit pas son cadre.
   */
  observer = new ResizeObserver(() => map?.invalidateSize())
  if (container.value) observer.observe(container.value)
})

watch([() => props.points, () => props.guide], () => {
  drawTrack()
  reframe()
})

watch(
  () => props.position,
  () => {
    reframe()
    drawPosition()
  },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = undefined
  map?.remove()
  map = undefined
  guideLine = undefined
  trackLine = undefined
  startMark = undefined
  hereMark = undefined
})
</script>

<template>
  <!-- Plein cadre, la carte se dessine toujours : elle est le fond de l'écran
       de course, et attendre deux points laisserait un rectangle noir. -->
  <div v-if="fill" ref="container" class="route-map route-map-fill absolute inset-0 size-full" />

  <div
    v-else-if="points.length > 1 || (guide && guide.length > 1)"
    ref="container"
    class="route-map w-full rounded-md border border-line"
    :style="{ height: `${height}px` }"
  />

  <p v-else class="text-meta text-text-dim">
    Une trace demande au moins deux points pour se dessiner.
  </p>
</template>

<style>
/* Les tuiles claires d'OSM passent en sombre sans changer de fournisseur. */
.route-map .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.7);
}

/* En plein soleil, la carte garde ses couleurs de jour (P21). */
.plein-soleil .route-map .leaflet-tile-pane {
  filter: none;
}

.route-map {
  background: var(--color-surface-inset);
}

.route-map .leaflet-control-attribution {
  background: rgba(22, 21, 20, 0.75);
  color: var(--color-text-dim);
  font-size: var(--text-caption);
}

.route-map .leaflet-control-attribution a {
  color: var(--color-text-dim);
}

.route-map .leaflet-bar a {
  background: var(--color-surface);
  border-color: var(--color-line);
  color: var(--color-text);
}

.route-map .leaflet-bar a:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

/* La mention de source se pose au-dessus de la zone sûre, pas sous le pouce. */
.route-map-fill .leaflet-control-attribution {
  margin-bottom: calc(150px + env(safe-area-inset-bottom));
}
</style>
