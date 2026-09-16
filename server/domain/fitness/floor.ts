import { vdotFromRace } from './vdot'

/** Longueur minimale d'un segment continu pour servir de plancher (§ 5). */
export const MIN_FLOOR_SEGMENT_M = 10_000

export interface ContinuousSegment {
  kmDebut: number
  kmFin: number
  /** Allure moyenne du segment, en secondes par kilomètre. */
  allureSKm: number
}

export interface VdotFloor {
  vdot: number
  segment: ContinuousSegment
}

/**
 * Plancher de VDOT déduit d'une course non représentative : on retient le
 * meilleur segment couru en continu d'au moins 10 km. Le résultat borne le
 * VDOT par le bas, il ne le mesure pas.
 */
export function vdotFloorFrom(segments: ContinuousSegment[]): VdotFloor | undefined {
  const eligible = segments.filter(
    (segment) => (segment.kmFin - segment.kmDebut) * 1000 >= MIN_FLOOR_SEGMENT_M,
  )
  if (eligible.length === 0) return undefined

  return eligible
    .map((segment) => {
      const distanceM = (segment.kmFin - segment.kmDebut) * 1000
      const timeS = (distanceM / 1000) * segment.allureSKm
      return { vdot: vdotFromRace(distanceM, timeS), segment }
    })
    .reduce((best, candidate) => (candidate.vdot > best.vdot ? candidate : best))
}
