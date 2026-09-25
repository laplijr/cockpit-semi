import { describe, expect, it } from 'vitest'
import type { PlanGateway } from '~~/server/application/ports'
import { regeneratePlan } from '~~/server/application/regenerate-plan'
import { DEFAULT_CONSTRAINTS } from '~~/server/domain/athlete/constraints'
import { addDays } from '~~/server/domain/plan/calendar'
import type { GeneratedPlan, RecentRun } from '~~/server/domain/plan/generate'
import { heldWeeklyVolume } from '~~/server/domain/plan/held-volume'
import { PlanTrigger } from '~~/server/domain/plan/session'
import { ObjectiveMode, RacePriority } from '~~/server/domain/races/race'

/** Un mercredi : les trois semaines closes commencent les 2, 9 et 16 nov. */
const TODAY = '2026-11-25'

/** Trois semaines closes à 24, 26,4 et 18,5 km — la dernière allégée. */
const RUNS: RecentRun[] = [
  { date: '2026-11-03', distanceM: 8_000 },
  { date: '2026-11-08', distanceM: 16_000 },
  { date: '2026-11-11', distanceM: 10_400 },
  { date: '2026-11-15', distanceM: 16_000 },
  { date: '2026-11-18', distanceM: 6_500 },
  { date: '2026-11-22', distanceM: 12_000 },
]

describe('heldWeeklyVolume', () => {
  it('rend la plus forte des trois dernières semaines closes', () => {
    expect(heldWeeklyVolume(RUNS, TODAY)).toBe(26_400)
  })

  it('ne compte pas la semaine en cours', () => {
    expect(heldWeeklyVolume([...RUNS, { date: '2026-11-24', distanceM: 30_000 }], TODAY)).toBe(
      26_400,
    )
  })

  it('ne dit rien quand une des trois semaines est vide', () => {
    const gap = RUNS.filter((run) => run.date < '2026-11-16' || run.date > '2026-11-22')
    expect(heldWeeklyVolume(gap, TODAY)).toBeNull()
  })
})

function gateway(runs: RecentRun[], pauseEnd: string | null = null) {
  const saved: GeneratedPlan[] = []
  const fake: PlanGateway = {
    loadAthlete: async () => ({
      constraints: DEFAULT_CONSTRAINTS,
      startWeeklyVolumeM: 20_000,
      peakWeeklyVolumeM: 45_000,
      maxWeeklyIncreasePct: 10,
      vdotGainPerBlock: 0.4,
      onboarded: true,
    }),
    loadRaces: async () => [
      {
        id: 1,
        name: 'Semi de Paris',
        date: '2027-03-07',
        distanceM: 21_097.5,
        priority: RacePriority.A,
        objectiveMode: ObjectiveMode.Time,
      },
    ],
    loadLatestPause: async () =>
      pauseEnd === null
        ? undefined
        : {
            id: 1,
            type: 'blessure',
            zone: 'pied',
            startDate: '2026-09-16',
            estimatedEndDate: null,
            endDate: pauseEnd,
            allowances: {
              running: false,
              cycling: true,
              upperBodyStrength: true,
              legStrength: true,
            },
            watchZones: [],
            notes: null,
          },
    loadCurrentFitness: async () => ({ date: '2026-11-16', vdot: 34, isFloor: false }),
    loadLastTestDate: async () => '2026-11-16',
    loadRunsSince: async () => runs,
    savePlan: async (plan) => {
      saved.push(plan)
      return 1
    },
    withPlanLock: (run) => run(),
    loadForecastContext: async () => ({ tests: [], races: [], open: [] }),
    saveForecasts: async () => {},
  }
  return { fake, saved }
}

const clock = { today: () => TODAY }

describe('régénération (§ 5, Volume et blocs)', () => {
  it('fait repartir l’escalier du volume tenu, pas du volume déclaré', async () => {
    const { fake, saved } = gateway(RUNS)
    await regeneratePlan(fake, clock, PlanTrigger.TestRecorded)
    expect(saved[0]!.weeks[0]!.targetRunM).toBe(26_400)
  })

  it('garde le volume déclaré sans trois semaines de réalisé', async () => {
    const { fake, saved } = gateway(RUNS.slice(0, 2))
    await regeneratePlan(fake, clock, PlanTrigger.TestRecorded)
    expect(saved[0]!.weeks[0]!.targetRunM).toBe(20_000)
  })

  it('garde le volume déclaré pour une reprise après pause', async () => {
    const { fake, saved } = gateway(RUNS, addDays(TODAY, -1))
    await regeneratePlan(fake, clock, PlanTrigger.TestRecorded)
    expect(saved[0]!.weeks[0]!.comebackRatio).not.toBeNull()
    expect(saved[0]!.weeks.find((week) => week.comebackRatio === 1)!.targetRunM).toBe(20_000)
  })
})
