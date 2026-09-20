import { describe, expect, it } from 'vitest'
import {
  applyRideSwap,
  type SessionSwapGateway,
  type StoredSession,
} from '~~/server/application/replace-ride-with-run'
import { TrainingZone, paceFor } from '~~/server/domain/fitness/vdot'
import { SessionStatus } from '~~/server/domain/plan/session'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { createClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'

const TODAY = '2026-11-18'
const VDOT = 35
const EASY_PACE = paceFor(VDOT, TrainingZone.Easy)
const WEEK_ID = 4

const fitness = {
  async loadCurrentFitness() {
    return { vdot: VDOT, isFloor: false, date: TODAY }
  },
}

function easyRun(id: number, date: string, distanceM: number): StoredSession {
  return {
    id,
    weekId: WEEK_ID,
    date,
    sport: Sport.Running,
    code: RunSessionCode.Endurance,
    status: SessionStatus.Planned,
    key: false,
    prescription: {
      code: RunSessionCode.Endurance,
      label: 'Endurance fondamentale',
      totalDistanceM: distanceM,
      qualityDistanceM: 0,
      expectedRpe: 3,
      steps: [{ label: 'Endurance', distanceM, paceSecPerKm: EASY_PACE }],
    },
  }
}

const RIDE: StoredSession = {
  id: 1,
  weekId: WEEK_ID,
  date: TODAY,
  sport: Sport.Cycling,
  code: 'Z2',
  status: SessionStatus.Planned,
  key: false,
  prescription: {
    code: 'Z2',
    label: 'Endurance Z2',
    totalDistanceM: 0,
    qualityDistanceM: 0,
    expectedRpe: 3,
    durationMin: 90,
    steps: [{ label: 'Zone 2', durationS: 72 * 60 }],
  },
}

const TARGET_CYCLING_MIN = 90

function fakeGateway() {
  const sessions = new Map<number, StoredSession>(
    [RIDE, easyRun(2, '2026-11-19', 9000), easyRun(3, '2026-11-21', 8000)].map((item) => [
      item.id,
      structuredClone(item),
    ]),
  )
  const week = { targetRunM: 40_000, targetCyclingMin: TARGET_CYCLING_MIN }

  const gateway: SessionSwapGateway & { sessions: typeof sessions; week: typeof week } = {
    sessions,
    week,
    async loadSession(id) {
      return sessions.get(id)
    },
    async loadWeek() {
      return week
    },
    async loadWeekSessions() {
      return [...sessions.values()]
    },
    async loadSessionsOn(date) {
      return [...sessions.values()].filter((item) => item.date === date)
    },
    async applyReplacement({ sessionId, prescription, givebacks, cyclingMinRemoved }) {
      const replaced = sessions.get(sessionId)!
      sessions.set(sessionId, {
        ...replaced,
        sport: Sport.Running,
        code: prescription.code,
        status: SessionStatus.Modified,
        prescription,
      })

      for (const giveback of givebacks) {
        const lender = sessions.get(giveback.sessionId)!
        sessions.set(giveback.sessionId, {
          ...lender,
          status: SessionStatus.Modified,
          prescription: giveback.prescription,
        })
      }

      week.targetCyclingMin = Math.max(0, week.targetCyclingMin - cyclingMinRemoved)
    },
  }

  return gateway
}

function runningVolume(gateway: ReturnType<typeof fakeGateway>): number {
  return [...gateway.sessions.values()]
    .filter((item) => item.sport === Sport.Running)
    .reduce((total, item) => total + item.prescription.totalDistanceM, 0)
}

describe('remplacement appliqué de bout en bout (§ 9, P6.42)', () => {
  it('laisse le volume de course de la semaine inchangé', async () => {
    const gateway = fakeGateway()
    const before = runningVolume(gateway)

    const outcome = await applyRideSwap(gateway, fitness, createClock(TODAY), RIDE.id)

    expect(outcome?.ok).toBe(true)
    expect(runningVolume(gateway)).toBe(before)
  })

  it('passe la séance en course et retire ses minutes de la cible vélo', async () => {
    const gateway = fakeGateway()
    await applyRideSwap(gateway, fitness, createClock(TODAY), RIDE.id)

    const replaced = gateway.sessions.get(RIDE.id)!
    expect(replaced.sport).toBe(Sport.Running)
    expect(replaced.code).toBe(RunSessionCode.Endurance)
    expect(replaced.status).toBe(SessionStatus.Modified)
    expect(gateway.week.targetCyclingMin).toBe(TARGET_CYCLING_MIN - 90)
  })

  it('refuse une seconde fois, la séance n’étant plus à faire', async () => {
    const gateway = fakeGateway()
    await applyRideSwap(gateway, fitness, createClock(TODAY), RIDE.id)

    const second = await applyRideSwap(gateway, fitness, createClock(TODAY), RIDE.id)
    expect(second).toEqual({ ok: false, refusal: expect.stringMatching(/plus à faire/) })
  })

  it('rend rien du tout sur une séance inconnue', async () => {
    const gateway = fakeGateway()
    expect(await applyRideSwap(gateway, fitness, createClock(TODAY), 99)).toBeUndefined()
  })
})
