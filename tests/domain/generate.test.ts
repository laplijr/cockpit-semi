import { describe, expect, it } from 'vitest'
import { generatePlan, nextSessionAfter, sessionsOn } from '~~/server/domain/plan/generate'
import { PhaseType } from '~~/server/domain/plan/phases'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'
import { RunSessionCode } from '~~/server/domain/running/session-types'

const CONSTRAINTS = { availableDays: [1, 2, 3, 5, 6, 7], longRunDay: 7, easyDays: [1] }

const RACES = [
  {
    id: 1,
    name: 'Semi de Paris',
    date: '2027-03-07',
    distanceM: 21097.5,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.Time,
  },
  {
    id: 2,
    name: 'Semi de Madrid',
    date: '2027-04-04',
    distanceM: 21097.5,
    priority: RacePriority.B,
    objectiveMode: ObjectiveMode.Time,
  },
  {
    id: 3,
    name: '5 km Île d’Arz',
    date: '2027-08-08',
    distanceM: 5000,
    priority: RacePriority.A,
    objectiveMode: ObjectiveMode.MaxPerformance,
  },
]

const BASE = {
  today: '2026-09-16',
  constraints: CONSTRAINTS,
  races: RACES,
  baseWeeklyVolumeM: 25_000,
  vdot: 33.15,
}

describe('génération du plan complet', () => {
  it('couvre le calendrier jusqu’à la dernière course', () => {
    const plan = generatePlan(BASE)
    expect(plan.weeks.at(-1)!.raceId).toBe(3)
    expect(plan.weeks.at(-1)!.phaseType).toBe(PhaseType.Taper)
  })

  it('se cale sur la reprise estimée quand une pause est ouverte', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-05' },
    })
    expect(plan.startDate).toBe('2026-10-05')
    expect(plan.provisional).toBe(true)
    expect(plan.weeks[0]!.comebackRatio).toBe(0.6)
  })

  it('ne déclenche pas de reprise surveillée sans pause', () => {
    const plan = generatePlan(BASE)
    expect(plan.provisional).toBe(false)
    expect(plan.weeks[0]!.comebackRatio).toBeUndefined()
  })

  it('ne démarre jamais dans le passé, même si la reprise estimée est dépassée', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-08-01', estimatedEndDate: '2026-08-20' },
    })
    expect(plan.startDate).toBe('2026-09-16')
  })

  it('ignore les courses déjà passées', () => {
    const plan = generatePlan({
      ...BASE,
      races: [
        {
          id: 9,
          name: 'Semi du 13 sept.',
          date: '2026-09-13',
          distanceM: 21500,
          priority: RacePriority.A,
          objectiveMode: ObjectiveMode.Time,
        },
        ...RACES,
      ],
    })
    expect(plan.phases.some((phase) => phase.raceId === 9)).toBe(false)
  })

  it('retrouve les séances d’un jour et la suivante', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-05' },
    })
    const monday = sessionsOn(plan, '2026-10-05')
    expect(monday).toHaveLength(1)
    expect(monday[0]!.code).toBe(RunSessionCode.Endurance)
    expect(nextSessionAfter(plan, '2026-10-05')!.date).toBe('2026-10-06')
  })

  it('ne planifie aucune séance avant la date de départ', () => {
    const plan = generatePlan({
      ...BASE,
      openPause: { startDate: '2026-09-16', estimatedEndDate: '2026-10-07' },
    })
    for (const week of plan.weeks) {
      for (const session of week.sessions) {
        expect(session.date >= plan.startDate).toBe(true)
      }
    }
  })
})
