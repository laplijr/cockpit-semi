import type { RoutingService } from '../../application/ports'
import type { GeoPoint } from '../../domain/routes/route'

const BASE_URL = 'https://api.openrouteservice.org'

/** Profil piéton : trottoirs et chemins, pas de voie rapide (§ 9). */
const PROFILE = 'foot-walking'

/**
 * La clé vit dans `runtimeConfig`, donc côté serveur uniquement : elle ne part
 * jamais dans le navigateur. Seule l'adresse saisie quitte le serveur — aucune
 * donnée d'entraînement n'accompagne l'appel (§ 9).
 */
function key(): string {
  const { orsApiKey } = useRuntimeConfig()
  if (!orsApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Clé OpenRouteService absente : renseigne NUXT_ORS_API_KEY.',
    })
  }
  return orsApiKey
}

async function ask<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  /** Hors du `try` : une clé absente est une erreur de configuration, pas une panne. */
  const authorization = key()

  try {
    const payload = await $fetch(`${BASE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      /** Sans `Accept`, l'API des itinéraires répond 406 sur le format GeoJSON. */
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json',
      },
      body,
    })
    return payload as T
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `OpenRouteService injoignable : ${(error as Error).message}`,
    })
  }
}

export function createRoutingService(): RoutingService {
  return {
    async geocode(address) {
      const query = new URLSearchParams({ text: address, size: '1' })
      const payload = await ask<GeoJsonCollection>(`/geocode/search?${query}`)
      const [point] = pointsOf(payload)

      if (!point) {
        throw createError({ statusCode: 422, statusMessage: `Adresse introuvable : ${address}.` })
      }
      return point
    },

    async roundTrip(start, distanceM, seed) {
      const payload = await ask<GeoJsonCollection>(`/v2/directions/${PROFILE}/geojson`, {
        coordinates: [[start.lon, start.lat]],
        elevation: true,
        options: { round_trip: { length: Math.round(distanceM), points: 5, seed } },
      })
      return pointsOf(payload)
    },

    async legTo(start, destination) {
      const payload = await ask<GeoJsonCollection>(`/v2/directions/${PROFILE}/geojson`, {
        coordinates: [
          [start.lon, start.lat],
          [destination.lon, destination.lat],
        ],
        elevation: true,
      })
      return pointsOf(payload)
    },
  }
}

interface GeoJsonCollection {
  features?: { geometry?: { type?: string; coordinates?: unknown } }[]
}

/**
 * GeoJSON range ses coordonnées en `[lon, lat, altitude]`, dans cet ordre. Un
 * `Point` (géocodage) porte un triplet, une `LineString` (itinéraire) en porte
 * la liste. Séparé du réseau pour être testé sur des réponses enregistrées.
 */
export function pointsOf(payload: GeoJsonCollection): GeoPoint[] {
  const geometry = payload.features?.[0]?.geometry
  if (!geometry) return []

  const raw = geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(raw)) return []

  return raw.flatMap((entry) => {
    if (!Array.isArray(entry)) return []
    const [lon, lat, elevation] = entry as number[]
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return []
    return [
      Number.isFinite(elevation)
        ? { lat: lat!, lon: lon!, elevationM: elevation! }
        : { lat: lat!, lon: lon! },
    ]
  })
}
