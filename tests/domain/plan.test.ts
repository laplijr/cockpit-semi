import { describe, expect, it } from 'vitest'
import { addWeeks, startOfWeek, weekday, weeksBetween } from '~~/server/domain/plan/calendar'
import { MAINTENANCE_WEEKS, buildPhases, phaseAtWeek } from '~~/server/domain/plan/periodization'
import { PhaseType } from '~~/server/domain/plan/phases'
import { UNKNOWN_FITNESS_TEST_WEEK, buildWeeks } from '~~/server/domain/plan/weeks'
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
  objectiveMode: ObjectiveMode.Time,
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

  it('fait absorber le mou du calendrier par la base courte, jamais par la récupération', () => {
    const arz = phases.filter((phase) => phase.raceId === ILE_D_ARZ.id)
    const weeksOf = (type: PhaseType) =>
      arz
        .filter((phase) => phase.type === type)
        .reduce((n, p) => n + p.endWeek - p.startWeek + 1, 0)

    expect(weeksOf(PhaseType.Recovery)).toBe(2)
    expect(weeksOf(PhaseType.Speed)).toBe(8)
    expect(weeksOf(PhaseType.Taper)).toBe(1)
    expect(weeksOf(PhaseType.ShortBase)).toBeGreaterThanOrEqual(4)
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
  const weeks = buildWeeks({
    startDate: REPRISE,
    phases,
    baseWeeklyVolumeM: 20_000,
    peakWeeklyVolumeM: 45_000,
  })

  it('commence le lundi de la semaine de reprise', () => {
    expect(weeks[0]!.startDate).toBe('2026-10-05')
    expect(weeks[0]!.endDate).toBe('2026-10-11')
  })

  it('applique la reprise 60 / 80 / 100 % à un volume de départ fixe', () => {
    expect(weeks.slice(0, 3).map((week) => week.comebackRatio)).toEqual([0.6, 0.8, 1])
    expect(weeks.slice(0, 3).map((week) => week.targetRunM)).toEqual([12_000, 16_000, 20_000])
    expect(weeks[3]!.comebackRatio).toBeUndefined()
  })

  it('gèle la progression de bloc pendant la reprise : aucune semaine allégée avant la 4e', () => {
    expect(weeks.slice(0, 3).every((week) => !week.light)).toBe(true)
  })

  it('ne monte jamais de plus de 10 % d’une semaine à l’autre après la semaine 1', () => {
    for (let i = 1; i < weeks.length; i++) {
      const previous = weeks[i - 1]!
      const current = weeks[i]!
      // La reprise suit ses propres ratios 60 / 80 / 100, pas la montée de bloc.
      if (current.comebackRatio || previous.comebackRatio) continue
      if (current.light || previous.light) continue
      if (current.phaseType !== previous.phaseType) continue
      expect(current.targetRunM).toBeLessThanOrEqual(previous.targetRunM * 1.1 + 1)
    }
  })

  it('n’autorise que l’endurance la première semaine et pas de lignes droites avant la 3e', () => {
    expect(weeks[0]!.allowedCodes).toEqual(['EF'])
    expect(weeks[1]!.allowedCodes).not.toContain('droites')
    expect(weeks[2]!.allowedCodes).toContain('droites')
    expect(weeks[3]!.allowedCodes).toBeUndefined()
  })

  it('plafonne le volume au pic', () => {
    expect(Math.max(...weeks.map((week) => week.targetRunM))).toBeLessThanOrEqual(45_000)
  })

  it('fait décroître l’affûtage de Paris, jamais croître', () => {
    const taper = weeks.filter(
      (week) => week.raceId === PARIS.id && week.phaseType === PhaseType.Taper,
    )
    expect(taper).toHaveLength(2)
    expect(taper[1]!.targetRunM).toBeLessThan(taper[0]!.targetRunM)
  })

  it('sort l’affûtage, la récup et la relance du rythme de bloc', () => {
    const outOfBlock = weeks.filter((week) =>
      [PhaseType.Taper, PhaseType.Recovery, PhaseType.Rebuild].includes(week.phaseType),
    )
    expect(outOfBlock.every((week) => !week.light)).toBe(true)
  })

  it('place un test 20′ en semaine 4, puis pas avant six semaines', () => {
    expect(weeks[3]!.test).toBe(true)
    const testWeeks = weeks.filter((week) => week.test).map((week) => week.index)
    for (let i = 1; i < testWeeks.length; i++) {
      expect(testWeeks[i]! - testWeeks[i - 1]!).toBeGreaterThanOrEqual(6)
    }
  })

  it('ne place jamais de test en affûtage ni en récupération', () => {
    for (const week of weeks.filter((item) => item.test)) {
      expect([PhaseType.Taper, PhaseType.Recovery]).not.toContain(week.phaseType)
    }
  })

  it('donne à chaque semaine sa position dans la phase, de 0 à 1', () => {
    for (const week of weeks) {
      expect(week.phaseProgress).toBeGreaterThanOrEqual(0)
      expect(week.phaseProgress).toBeLessThanOrEqual(1)
    }
  })
})

describe('cycle d’entretien, quand aucune course ne structure le calendrier (§ 5)', () => {
  const phases = buildPhases(REPRISE, [])

  it('alterne base et développement sur trois blocs de quatre semaines', () => {
    expect(phases.map((phase) => [phase.type, phase.endWeek - phase.startWeek + 1])).toEqual([
      [PhaseType.Base, 4],
      [PhaseType.Development, 4],
      [PhaseType.Base, 4],
    ])
    expect(phases.at(-1)!.endWeek).toBe(MAINTENANCE_WEEKS)
  })

  it('n’ouvre ni affûtage ni récup : il n’y a rien à préparer', () => {
    const types = phases.map((phase) => phase.type)
    expect(types).not.toContain(PhaseType.Taper)
    expect(types).not.toContain(PhaseType.Recovery)
  })

  it('ne rattache ses phases à aucune course', () => {
    expect(phases.every((phase) => phase.raceId === null)).toBe(true)
  })

  it('remplit ses douze semaines et allège la quatrième de chaque bloc', () => {
    const weeks = buildWeeks({
      startDate: REPRISE,
      phases,
      baseWeeklyVolumeM: 20_000,
      peakWeeklyVolumeM: 45_000,
      comebackWeeks: 0,
    })

    expect(weeks).toHaveLength(MAINTENANCE_WEEKS)
    expect(weeks.every((week) => week.targetRunM > 0)).toBe(true)
    expect(weeks.filter((week) => week.light).map((week) => week.index)).toEqual([4, 8, 12])
  })

  it('prend aussi la main quand les seules courses inscrites sont en priorité C', () => {
    const fun = { ...PARIS, priority: RacePriority.C }
    expect(buildPhases(REPRISE, [fun]).map((phase) => phase.raceId)).toEqual([null, null, null])
  })

  it('rend la main au rétro-planning dès qu’une course est ajoutée', () => {
    const structured = buildPhases(REPRISE, [PARIS])
    expect(structured.every((phase) => phase.raceId === PARIS.id)).toBe(true)
    expect(structured.at(-1)!.type).toBe(PhaseType.Taper)
  })

  it('revient à l’entretien quand la course est supprimée', () => {
    expect(buildPhases(REPRISE, [PARIS]).at(-1)!.type).toBe(PhaseType.Taper)
    expect(buildPhases(REPRISE, []).at(-1)!.type).toBe(PhaseType.Base)
  })
})

describe('plan sans point de forme (§ 5)', () => {
  const phases = buildPhases(REPRISE, ALL_RACES)
  const weeks = buildWeeks({
    startDate: REPRISE,
    phases,
    baseWeeklyVolumeM: 20_000,
    peakWeeklyVolumeM: 45_000,
    comebackWeeks: 0,
    vdotKnown: false,
  })

  it('avance le test 20′ en semaine 2', () => {
    expect(weeks[1]!.index).toBe(UNKNOWN_FITNESS_TEST_WEEK)
    expect(weeks[1]!.test).toBe(true)
    expect(weeks[0]!.test).toBe(false)
  })

  it('n’autorise que l’endurance avant le test', () => {
    expect(weeks[0]!.allowedCodes).toEqual(['EF'])
    expect(weeks[1]!.allowedCodes).toBeUndefined()
  })

  it('laisse le test en semaine 4 quand une reprise surveillée est en cours', () => {
    const comeback = buildWeeks({
      startDate: REPRISE,
      phases,
      baseWeeklyVolumeM: 20_000,
      peakWeeklyVolumeM: 45_000,
      vdotKnown: false,
    })
    expect(comeback.filter((week) => week.test).at(0)!.index).toBe(4)
  })
})
