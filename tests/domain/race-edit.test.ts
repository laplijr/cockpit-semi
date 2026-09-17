import { describe, expect, it } from 'vitest'
import { RacePriority, racePlansChanged, type PlanningFields } from '~~/server/domain/races/race'
import { ObjectiveMode } from '~~/server/domain/races/race'

const PARIS: PlanningFields = {
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
}

describe('ce qui régénère le plan après modification (§ 9, P5.10 et P5.15)', () => {
  it('ne régénère pas quand rien de structurant ne bouge', () => {
    expect(racePlansChanged(PARIS, { ...PARIS })).toBe(false)
  })

  it('régénère sur la date, la distance et la priorité', () => {
    expect(racePlansChanged(PARIS, { ...PARIS, date: '2027-03-14' })).toBe(true)
    expect(racePlansChanged(PARIS, { ...PARIS, distanceM: 42195 })).toBe(true)
    expect(racePlansChanged(PARIS, { ...PARIS, priority: RacePriority.B })).toBe(true)
  })

  /**
   * `specsFor` ne lit que la priorité et la distance : changer de mode
   * d'objectif régénérerait un plan identique (§ 9, P5.15).
   */
  it('ne régénère pas pour le mode d’objectif', () => {
    const before = { ...PARIS, objectiveMode: ObjectiveMode.Time }
    const after = { ...PARIS, objectiveMode: ObjectiveMode.Record }
    expect(racePlansChanged(before, after)).toBe(false)
  })

  /**
   * Le chrono visé, le dénivelé, la météo et la note changent l'affichage.
   * Régénérer pour eux jetterait des séances déjà posées.
   */
  it('ne régénère pas pour les niveaux d’objectif ni pour les champs d’affichage', () => {
    const withObjective = { ...PARIS, objectifS: 5880, objectifAmbitionS: 5700 }
    expect(racePlansChanged(PARIS, withObjective)).toBe(false)

    const withProfile = { ...PARIS, elevationGainM: 180, expectedTempC: 14, notes: 'plat' }
    expect(racePlansChanged(PARIS, withProfile)).toBe(false)
  })
})
