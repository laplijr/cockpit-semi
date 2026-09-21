import { distanceBetween, elevationGain } from '../routes/geometry'
import type { GeoPoint } from '../routes/route'
import { acceptFix, FIX_TOLERANCE, type GeoFix } from './fix'

/** Un relevé retenu, avec la distance parcourue jusqu'à lui et le temps écoulé. */
export interface TrackPoint extends GeoFix {
  distanceM: number
  elapsedS: number
}

export interface Track {
  points: TrackPoint[]
  distanceM: number
  /** Temps écoulé, trous et pauses déduits : ce qu'affiche le chrono. */
  elapsedS: number
  elevationGainM: number
  rejected: number
}

export interface Split {
  /** Kilomètre plein, 1 pour le premier. */
  km: number
  seconds: number
}

const EMPTY: Track = { points: [], distanceM: 0, elapsedS: 0, elevationGainM: 0, rejected: 0 }

/**
 * Mesure une suite de relevés : distance, temps écoulé, D+.
 * La distance s'accumule depuis une ancre qui ne bouge qu'au-delà du seuil de
 * déplacement — c'est ce qui empêche la dérive à l'arrêt de compter (§ 9, P10).
 */
export function measureTrack(fixes: GeoFix[]): Track {
  const points: TrackPoint[] = []
  let previous: GeoFix | undefined
  let anchor: GeoFix | undefined
  let distanceM = 0
  let elapsedS = 0
  let rejected = 0

  for (const fix of fixes) {
    if (!acceptFix(fix, previous)) {
      rejected += 1
      continue
    }

    if (previous !== undefined) {
      const seconds = (fix.at - previous.at) / 1000
      /** Un trou n'est pas du temps de course : on ne sait pas ce qui s'y est passé. */
      if (seconds <= FIX_TOLERANCE.gapS) elapsedS += seconds
    }

    const fromAnchor = anchor === undefined ? 0 : distanceBetween(anchor, fix)
    if (anchor === undefined || fromAnchor >= FIX_TOLERANCE.minMoveM) {
      distanceM += fromAnchor
      anchor = fix
    }

    previous = fix
    points.push({ ...fix, distanceM: Math.round(distanceM), elapsedS: Math.round(elapsedS) })
  }

  if (points.length === 0) return { ...EMPTY, rejected }

  return {
    points,
    distanceM: Math.round(distanceM),
    elapsedS: Math.round(elapsedS),
    elevationGainM: elevationGain(points, FIX_TOLERANCE.elevationNoiseM),
    rejected,
  }
}

/**
 * Allure des dernières secondes, en secondes par kilomètre. Nulle tant que la
 * fenêtre ne porte pas de quoi la calculer : une allure fausse est pire que
 * pas d'allure, on la lit en courant.
 */
export function smoothedPace(track: Track, windowS = FIX_TOLERANCE.paceWindowS): number | null {
  const last = track.points.at(-1)
  if (last === undefined) return null

  const from = track.points.find((point) => last.elapsedS - point.elapsedS <= windowS)
  if (from === undefined) return null

  const seconds = last.elapsedS - from.elapsedS
  const metres = last.distanceM - from.distanceM

  if (seconds < windowS / 3 || metres < FIX_TOLERANCE.minMoveM * 4) return null
  return Math.round((seconds / metres) * 1000)
}

/** Allure moyenne de la sortie, en secondes par kilomètre. */
export function averagePace(track: Track): number | null {
  if (track.distanceM < FIX_TOLERANCE.minMoveM * 4) return null
  return Math.round((track.elapsedS / track.distanceM) * 1000)
}

/**
 * Temps de chaque kilomètre plein, interpolé entre les deux relevés qui
 * l'encadrent : la borne tombe presque toujours entre deux points.
 */
export function splits(track: Track, everyM = 1000): Split[] {
  const found: Split[] = []
  let target = everyM

  for (let index = 1; index < track.points.length; index += 1) {
    const before = track.points[index - 1]!
    const after = track.points[index]!

    while (after.distanceM >= target && before.distanceM < target) {
      const span = after.distanceM - before.distanceM
      const share = span === 0 ? 0 : (target - before.distanceM) / span
      const at = before.elapsedS + (after.elapsedS - before.elapsedS) * share

      found.push({ km: found.length + 1, seconds: Math.round(at - cumulated(found)) })
      target += everyM
    }
  }

  return found
}

/** Temps cumulé des kilomètres déjà relevés : un split est un temps de tour. */
function cumulated(found: Split[]): number {
  return found.reduce((total, split) => total + split.seconds, 0)
}

/**
 * Écart à la boucle proposée, en mètres : la plus courte distance à l'un de
 * ses segments. Nul quand il n'y a pas de trace à suivre.
 */
export function offTrackM(position: GeoPoint, guide: GeoPoint[]): number | null {
  if (guide.length < 2) return null

  let shortest = Number.POSITIVE_INFINITY
  for (let index = 1; index < guide.length; index += 1) {
    shortest = Math.min(shortest, toSegmentM(position, guide[index - 1]!, guide[index]!))
  }

  return Math.round(shortest)
}

/**
 * Distance d'un point à un segment, en mètres. La projection se fait en plan
 * local : sur quelques centaines de mètres, la courbure de la Terre ne change
 * rien et le calcul reste lisible.
 */
function toSegmentM(point: GeoPoint, from: GeoPoint, to: GeoPoint): number {
  const scale = Math.cos((from.lat * Math.PI) / 180)
  const x = (point.lon - from.lon) * scale
  const y = point.lat - from.lat
  const dx = (to.lon - from.lon) * scale
  const dy = to.lat - from.lat

  const squared = dx * dx + dy * dy
  const share = squared === 0 ? 0 : Math.min(1, Math.max(0, (x * dx + y * dy) / squared))

  return distanceBetween(point, {
    lat: from.lat + dy * share,
    lon: from.lon + (to.lon - from.lon) * share,
  })
}
