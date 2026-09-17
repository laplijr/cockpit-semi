export interface TracePoint {
  lat: number
  lon: number
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
