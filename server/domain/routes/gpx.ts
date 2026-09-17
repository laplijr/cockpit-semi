import type { GeoPoint } from './route'

/**
 * GPX 1.1 réduit à ce qu'une montre lit : une trace, ses points, leur altitude.
 * Écrit et lu à la main — une dépendance XML pour trois balises coûterait plus
 * qu'elle ne rapporte, et le format est figé depuis 2004.
 */
const TRACK_POINT = /<trkpt\s+[^>]*?>[\s\S]*?<\/trkpt>|<trkpt\s+[^>]*?\/>/g
const LATITUDE = /lat\s*=\s*"([^"]+)"/
const LONGITUDE = /lon\s*=\s*"([^"]+)"/
const ELEVATION = /<ele>\s*([^<]+)\s*<\/ele>/

export function parseGpx(xml: string): GeoPoint[] {
  return [...xml.matchAll(TRACK_POINT)].flatMap((match) => {
    const raw = match[0]
    const lat = Number(LATITUDE.exec(raw)?.[1])
    const lon = Number(LONGITUDE.exec(raw)?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return []

    const elevation = Number(ELEVATION.exec(raw)?.[1])
    return [Number.isFinite(elevation) ? { lat, lon, elevationM: elevation } : { lat, lon }]
  })
}

export function toGpx(name: string, points: GeoPoint[]): string {
  const track = points
    .map((point) => {
      const elevation =
        point.elevationM === undefined ? '' : `<ele>${point.elevationM.toFixed(1)}</ele>`
      return `      <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}">${elevation}</trkpt>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cockpit" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${track}
    </trkseg>
  </trk>
</gpx>
`
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character]!)
}
