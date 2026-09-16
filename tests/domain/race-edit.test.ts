import { describe, expect, it } from 'vitest'
import {
  ObjectiveMode,
  RacePriority,
  racePlansChanged,
  type PlanningFields,
} from '~~/server/domain/races/race'

const PARIS: PlanningFields = {
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.MaxPerformance,
}

describe('ce qui régénère le plan après modification (§ 9, P5.10)', () => {
  it('ne régénère pas quand rien de structurant ne bouge', () => {
    expect(racePlansChanged(PARIS, { ...PARIS })).toBe(false)
  })

  it('régénère sur la date, la distance, la priorité et le mode d’objectif', () => {
    expect(racePlansChanged(PARIS, { ...PARIS, date: '2027-03-14' })).toBe(true)
    expect(racePlansChanged(PARIS, { ...PARIS, distanceM: 42195 })).toBe(true)
    expect(racePlansChanged(PARIS, { ...PARIS, priority: RacePriority.B })).toBe(true)
    expect(racePlansChanged(PARIS, { ...PARIS, objectiveMode: ObjectiveMode.Time })).toBe(true)
  })

  /**
   * Le chrono visé, le dénivelé, la météo et la note changent l'affichage.
   * Régénérer pour eux jetterait des séances déjà posées.
   */
  it('ne régénère pas pour un objectif chiffré ni pour les champs d’affichage', () => {
    const withObjective = { ...PARIS, objectifS: 5880 } as PlanningFields & { objectifS: number }
    expect(racePlansChanged(PARIS, withObjective)).toBe(false)

    const withProfile = { ...PARIS, elevationGainM: 180, expectedTempC: 14, notes: 'plat' }
    expect(racePlansChanged(PARIS, withProfile as PlanningFields)).toBe(false)
  })
})
