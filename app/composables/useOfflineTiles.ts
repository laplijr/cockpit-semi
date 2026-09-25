/**
 * Garder la carte avant de partir (§ 9, P10.3) : sans réseau, les tuiles ne
 * se chargent plus et la carte est grise. Quelques dizaines de tuiles au zoom
 * utile, demandées une fois — le navigateur les garde dans son cache HTTP —
 * et bornées pour rester dans les limites d'usage d'OpenStreetMap.
 */
const TILE_ZOOM = 15
const MAX_TILES = 64

interface Point {
  lat: number
  lon: number
}

function tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom)
}

function tileY(lat: number, zoom: number): number {
  const radians = (lat * Math.PI) / 180
  const merc = Math.log(Math.tan(radians) + 1 / Math.cos(radians))
  return Math.floor(((1 - merc / Math.PI) / 2) * 2 ** zoom)
}

/** Une tuile de marge autour de la boîte : la trace passe rarement au centre. */
function tileUrls(points: Point[]): string[] {
  const xs = points.map((point) => tileX(point.lon, TILE_ZOOM))
  const ys = points.map((point) => tileY(point.lat, TILE_ZOOM))
  const urls: string[] = []

  for (let x = Math.min(...xs) - 1; x <= Math.max(...xs) + 1; x += 1) {
    for (let y = Math.min(...ys) - 1; y <= Math.max(...ys) + 1; y += 1) {
      urls.push(`https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`)
    }
  }
  return urls.slice(0, MAX_TILES)
}

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

/** La boucle connue, les tuiles partent avec : c'est le seul moment tranquille. */
export function useOfflineTiles(points: () => Point[]) {
  const ready = ref(false)

  watch(
    points,
    async (current) => {
      if (current.length < 2 || ready.value) return
      await Promise.all(tileUrls(current).map(preload))
      ready.value = true
    },
    { immediate: true },
  )

  return ready
}
