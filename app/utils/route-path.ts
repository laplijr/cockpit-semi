export interface TracePoint {
  lat: number
  lon: number
}

/** L'URL de Google Maps n'accepte pas plus d'étapes que ça entre deux points. */
const MAX_WAYPOINTS = 9

/**
 * Ouvre la boucle dans Google Maps, à pied. Le tracé y est **redessiné** entre
 * les étapes échantillonnées : c'est une vue du parcours sur une carte, pas le
 * GPX au mètre près — celui-là se télécharge.
 */
export function walkingMapUrl(points: TracePoint[]): string | null {
  const start = points.at(0)
  const end = points.at(-1)
  if (!start || !end) return null

  const at = (point: TracePoint) => `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`
  const step = Math.max(1, Math.floor((points.length - 2) / MAX_WAYPOINTS))
  const waypoints = points
    .slice(1, -1)
    .filter((_, index) => index % step === 0)
    .slice(0, MAX_WAYPOINTS)
    .map(at)

  const query = new URLSearchParams({
    api: '1',
    origin: at(start),
    destination: at(end),
    travelmode: 'walking',
  })
  if (waypoints.length > 0) query.set('waypoints', waypoints.join('|'))

  return `https://www.google.com/maps/dir/?${query}`
}

/** Veille d'une date ISO, pour la date d'arrivée par défaut (§ 9, P5.5). */
export function isoDayBefore(iso: string): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/**
 * Chemin SVG d'une trace, sans fond de carte ni bibliothèque (§ 9, P5.5). À
 * l'échelle de quelques kilomètres une projection plate suffit ; seul le
 * facteur cos(latitude) compte, sans quoi la boucle s'étire en largeur. Le
 * tracé garde ses proportions et se centre dans la boîte.
 */
export function routePath(
  points: TracePoint[],
  width: number,
  height: number,
  padding = 4,
): string {
  if (points.length < 2) return ''

  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const scaleX = Math.cos((meanLat * Math.PI) / 180)

  const xs = points.map((point) => point.lon * scaleX)
  const ys = points.map((point) => -point.lat)

  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  const span = Math.max(spanX, spanY)
  if (span === 0) return ''

  const usable = Math.min(width, height) - 2 * padding
  const scale = usable / span
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  return xs
    .map((x, index) => {
      const px = offsetX + (x - Math.min(...xs)) * scale
      const py = offsetY + (ys[index]! - Math.min(...ys)) * scale
      return `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
    })
    .join(' ')
}
