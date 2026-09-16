import { describe, expect, it } from 'vitest'
import { vdotFloorFrom } from '~~/server/domain/fitness/floor'
import { SegmentMode } from '~~/server/domain/races/race'

/** Semi du 13 sept. 2026 : 21,5 km en 2:26:00, blessure au km 14 (§ 0). */
const REFERENCE_RACE = [
  { kmDebut: 0, kmFin: 14, allureSKm: 360, mode: SegmentMode.Running },
  { kmDebut: 14, kmFin: 19, allureSKm: 600, mode: SegmentMode.WalkRun },
  { kmDebut: 19, kmFin: 21.5, allureSKm: 360, mode: SegmentMode.Running },
]

describe('plancher de VDOT depuis une course non représentative', () => {
  it('retient le segment continu de 14 km à 6:00/km et donne VDOT ≈ 33', () => {
    const floor = vdotFloorFrom(REFERENCE_RACE)
    expect(floor?.segment.kmFin).toBe(14)
    expect(floor?.vdot).toBeGreaterThan(32)
    expect(floor?.vdot).toBeLessThan(34)
  })

  it('ignore les segments de moins de 10 km', () => {
    const floor = vdotFloorFrom([{ kmDebut: 19, kmFin: 21.5, allureSKm: 300 }])
    expect(floor).toBeUndefined()
  })

  it('ne retourne rien quand la course n’a aucun segment', () => {
    expect(vdotFloorFrom([])).toBeUndefined()
  })

  it('retient le meilleur segment quand plusieurs sont éligibles', () => {
    const floor = vdotFloorFrom([
      { kmDebut: 0, kmFin: 10, allureSKm: 400 },
      { kmDebut: 10, kmFin: 21, allureSKm: 340 },
    ])
    expect(floor?.segment.kmDebut).toBe(10)
  })
})
