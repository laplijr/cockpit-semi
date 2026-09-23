import { describe, expect, it } from 'vitest'
import {
  AthleteProfile,
  CAREFUL_INCREASE_PCT,
  PROFILES_BY_LOAD,
  STANDARD_INCREASE_PCT,
  ageOn,
  defaultsFor,
  estimatedMaxHr,
} from '~~/server/domain/athlete/profile'
import { generatePlan } from '~~/server/domain/plan/generate'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'

describe('profil physique (§ 9, P5.7)', () => {
  it('donne des repères distincts et croissants du débutant à l’athlète', () => {
    const volumes = PROFILES_BY_LOAD.map((profile) => defaultsFor(profile))

    for (const [index, current] of volumes.slice(1).entries()) {
      const previous = volumes[index]!
      expect(current.startWeeklyVolumeM).toBeGreaterThan(previous.startWeeklyVolumeM)
      expect(current.peakWeeklyVolumeM).toBeGreaterThan(previous.peakWeeklyVolumeM)
      expect(current.runsPerWeek).toBeGreaterThanOrEqual(previous.runsPerWeek)
    }

    expect(new Set(volumes.map((item) => item.startWeeklyVolumeM)).size).toBe(volumes.length)
  })

  it('borne la montée à 5 % en reprise et chez le débutant, 10 % ailleurs', () => {
    expect(defaultsFor(AthleteProfile.Comeback).maxWeeklyIncreasePct).toBe(CAREFUL_INCREASE_PCT)
    expect(defaultsFor(AthleteProfile.Beginner).maxWeeklyIncreasePct).toBe(CAREFUL_INCREASE_PCT)
    expect(defaultsFor(AthleteProfile.Athlete).maxWeeklyIncreasePct).toBe(STANDARD_INCREASE_PCT)
    expect(defaultsFor(AthleteProfile.Regular).maxWeeklyIncreasePct).toBe(STANDARD_INCREASE_PCT)
  })
})

describe('FC max estimée (Tanaka)', () => {
  it('donne 180 à 40 ans', () => {
    expect(estimatedMaxHr(40)).toBe(180)
  })

  it('décroît avec l’âge', () => {
    expect(estimatedMaxHr(30)).toBeGreaterThan(estimatedMaxHr(50))
  })
})

describe('âge', () => {
  it('suit le jour simulé, anniversaire compris', () => {
    expect(ageOn('1986-06-15', '2026-06-14')).toBe(39)
    expect(ageOn('1986-06-15', '2026-06-15')).toBe(40)
    expect(ageOn('1986-06-15', '2026-11-22')).toBe(40)
  })

  it('gère un anniversaire en fin d’année', () => {
    expect(ageOn('1990-12-31', '2026-12-30')).toBe(35)
    expect(ageOn('1990-12-31', '2026-12-31')).toBe(36)
  })
})

const PARIS = {
  id: 1,
  name: 'Semi de Paris',
  date: '2027-03-07',
  distanceM: 21097.5,
  priority: RacePriority.A,
  objectiveMode: ObjectiveMode.Time,
}

const plan = (maxWeeklyIncreasePct?: number) =>
  generatePlan({
    today: '2026-10-05',
    constraints: { availableDays: [1, 2, 3, 4, 5, 6, 7], longRunDay: 7, easyDays: [1] },
    races: [PARIS],
    baseWeeklyVolumeM: 20_000,
    peakWeeklyVolumeM: 45_000,
    vdot: 33.15,
    comebackWeeks: 0,
    maxWeeklyIncreasePct,
  })

/**
 * Montées d'une semaine pleine à la suivante, hors semaines allégées. Une
 * semaine réduite par les plafonds de la sortie longue annonce ce qu'elle pose
 * et sort de la trajectoire : la suivante y revient, ce n'est pas un palier (§ 5).
 */
function climbs(weeks: { targetRunM: number; light: boolean; volumeCapped: boolean }[]) {
  const full = weeks.filter((week) => !week.light)
  return full
    .slice(1)
    .map((week, index) => ({ from: full[index]!, to: week }))
    .filter((step) => !step.from.volumeCapped)
    .map((step) => ({ from: step.from.targetRunM, to: step.to.targetRunM }))
    .filter((step) => step.to > step.from)
}

describe('plafond de progression tiré du profil (§ 5)', () => {
  it('ne dépasse jamais 5 % par semaine en reprise', () => {
    // Les volumes sont arrondis au mètre : la borne se compare en mètres, pas en ratio.
    for (const step of climbs(plan(CAREFUL_INCREASE_PCT).weeks)) {
      expect(step.to).toBeLessThanOrEqual(Math.ceil(step.from * 1.05))
    }
  })

  it('laisse le comportement inchangé en profil athlète', () => {
    expect(plan(STANDARD_INCREASE_PCT).weeks.map((week) => week.targetRunM)).toEqual(
      plan().weeks.map((week) => week.targetRunM),
    )
  })

  it('monte plus lentement en reprise qu’en athlète', () => {
    const careful = plan(CAREFUL_INCREASE_PCT).weeks.at(-1)!.targetRunM
    const standard = plan(STANDARD_INCREASE_PCT).weeks.at(-1)!.targetRunM
    expect(careful).toBeLessThan(standard)
  })
})
