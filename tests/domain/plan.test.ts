import { describe, expect, it } from 'vitest'
import { addWeeks, startOfWeek, weekday, weeksBetween } from '~~/server/domain/plan/calendar'
import { buildPhases, phaseAtWeek } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import { LONG_RUN_MAX_SHARE, buildWeeks } from '~~/server/domain/plan/weeks'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'

/** Les trois courses réelles du § 0, calées sur une reprise au 5 oct. 2026. */
const REPRISE = '2026-10-05'

const PARIS = {
  id: 1,
  name: 'Semi de Paris',
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.Time,
}

const MADRID = {
  id: 2,
  name: 'Semi de Madrid',
  date: '2027-04-04',
  distanceM: 21097.5,
  priority: RacePriority.B,
  objectiveMode: ObjectiveMode.Time,
}

const ILE_D_ARZ = {
  id: 3,
  name: '5 km Île d’Arz',
  date: '2027-08-08',
  distanceM: 5000,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.MaxPerformance,
}

const ALL_RACES = [PARIS, MADRID, ILE_D_ARZ]

describe('calendrier', () => {
  it('numérote les jours de lundi à dimanche', () => {
    expect(weekday('2026-10-05')).toBe(1)
    expect(weekday('2026-10-11')).toBe(7)
  })

  it('ramène une date au lundi de sa semaine', () => {
    expect(startOfWeek('2026-10-08')).toBe('2026-10-05')
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05')
  })

  it('compte les semaines entre deux dates', () => {
    expect(weeksBetween('2027-03-07', '2027-04-04')).toBe(4)
    expect(addWeeks('2026-10-05', 2)).toBe('2026-10-19')
  })
})

describe('périodisation des trois courses du § 0', () => {
  const phases = buildPhases(REPRISE, ALL_RACES)

  it('produit trois cycles, un par course structurante', () => {
    expect(new Set(phases.map((phase) => phase.raceId))).toEqual(new Set([1, 2, 3]))
  })

  it('n’a aucune collision : les phases se suivent sans trou ni chevauchement', () => {
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.startWeek).toBe(phases[i - 1]!.endWeek + 1)
    }
    expect(phases[0]!.startWeek).toBe(1)
  })

  it('termine le cycle de Paris par un affûtage', () => {
    const paris = phases.filter((phase) => phase.raceId === PARIS.id)
    expect(paris.at(-1)!.type).toBe(PhaseType.Taper)
    expect(paris.map((phase) => phase.type)).toContain(PhaseType.Base)
    expect(paris.map((phase) => phase.type)).toContain(PhaseType.Specific)
  })

  it('donne à Madrid, à 4 semaines de Paris, un mini-cycle Récup 2 · Relance 1 · Affûtage 1', () => {
    const madrid = phases.filter((phase) => phase.raceId === MADRID.id)
    expect(madrid.map((phase) => [phase.type, phase.endWeek - phase.startWeek + 1])).toEqual([
      [PhaseType.Recovery, 2],
      [PhaseType.Rebuild, 1],
      [PhaseType.Taper, 1],
    ])
  })

  it('donne au 5 km un cycle vitesse et non un cycle long', () => {
    const arz = phases.filter((phase) => phase.raceId === ILE_D_ARZ.id).map((phase) => phase.type)
    expect(arz).toContain(PhaseType.Speed)
    expect(arz).toContain(PhaseType.ShortBase)
    expect(arz).not.toContain(PhaseType.Development)
  })

  it('retrouve la phase d’une semaine donnée', () => {
    expect(phaseAtWeek(phases, 1)!.type).toBe(PhaseType.Base)
    expect(phaseAtWeek(phases, 9999)).toBeUndefined()
  })
})

describe('semaines générées', () => {
  const phases = buildPhases(REPRISE, ALL_RACES)
  const weeks = buildWeeks({ startDate: REPRISE, phases, baseWeeklyVolumeM: 25_000 })

  it('commence le lundi de la semaine de reprise', () => {
    expect(weeks[0]!.startDate).toBe('2026-10-05')
    expect(weeks[0]!.endDate).toBe('2026-10-11')
  })

  it('applique la reprise surveillée 60 / 80 / 100 % sur trois semaines', () => {
    expect(weeks.slice(0, 3).map((week) => week.comebackRatio)).toEqual([0.6, 0.8, 1])
    expect(weeks[3]!.comebackRatio).toBeUndefined()
  })

  it('n’autorise que l’endurance la première semaine et pas de VMA avant la semaine 3', () => {
    expect(weeks[0]!.allowedCodes).toEqual(['EF'])
    expect(weeks[1]!.allowedCodes).not.toContain('VMA')
    expect(weeks[2]!.allowedCodes).not.toContain('VMA')
    expect(weeks[3]!.allowedCodes).toBeUndefined()
  })

  it('allège la quatrième semaine de chaque bloc de 30 %', () => {
    expect(weeks[3]!.light).toBe(true)
    expect(weeks[7]!.light).toBe(true)
    expect(weeks[4]!.light).toBe(false)

    const rampTop = weeks[6]!.targetRunM
    expect(weeks[7]!.targetRunM).toBeCloseTo(rampTop * 0.7, -2)
  })

  it('ne dépasse jamais +10 % d’une semaine à l’autre en montée', () => {
    for (let i = 1; i < weeks.length; i++) {
      const previous = weeks[i - 1]!
      const current = weeks[i]!
      if (current.light || previous.light || current.comebackRatio || previous.comebackRatio)
        continue
      if (current.phaseType !== previous.phaseType) continue
      expect(current.targetRunM).toBeLessThanOrEqual(previous.targetRunM * 1.1 + 1)
    }
  })

  it('borne la sortie longue à 30 % du volume de la semaine', () => {
    for (const week of weeks) {
      expect(week.longRunMaxM).toBeLessThanOrEqual(week.targetRunM * LONG_RUN_MAX_SHARE + 1)
    }
  })

  it('réduit le volume en affûtage et en récupération', () => {
    const taper = weeks.find((week) => week.phaseType === PhaseType.Taper)!
    const specific = weeks.filter((week) => week.phaseType === PhaseType.Specific).at(-1)!
    expect(taper.targetRunM).toBeLessThan(specific.targetRunM)
  })
})
