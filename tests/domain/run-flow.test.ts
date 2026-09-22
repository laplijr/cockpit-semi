import { describe, expect, it } from 'vitest'
import type {
  ActivityImportGateway,
  ActivityRow,
  CapturedOuting,
} from '~~/server/application/import-activities'
import type { FeedbackGateway, FeedbackInput } from '~~/server/application/record-feedback'
import {
  abandonRun,
  checkpointRun,
  finishRun,
  startRun,
  type ClosedRun,
  type RunGateway,
  type StoredRun,
} from '~~/server/application/record-run'
import { Sensation } from '~~/server/domain/load/feedback'
import type { CandidateSession } from '~~/server/domain/matching/match-activity'
import { fixedClock } from '~~/server/domain/shared/clock'
import { Sport } from '~~/server/domain/shared/sport'
import type { GeoFix } from '~~/server/domain/tracking/fix'
import { RunStatus } from '~~/server/domain/tracking/run'

const TODAY = '2027-03-01'
const T0 = Date.parse('2027-03-01T08:00:00Z')
const START = { lat: 47.6586, lon: -2.7599 }
const METRE_IN_LAT = 1 / 111_320

/** Une sortie en ligne droite : deux kilomètres en dix minutes. */
function fixes(seconds: number): GeoFix[] {
  return Array.from({ length: seconds + 1 }, (_, index) => ({
    lat: START.lat + index * 3.33 * METRE_IN_LAT,
    lon: START.lon,
    accuracyM: 6,
    at: T0 + index * 1000,
  }))
}

interface Bench {
  runs: RunGateway
  activities: ActivityImportGateway
  feedback: FeedbackGateway
  stored: StoredRun[]
  closed: (ClosedRun & { runId: number })[]
  saved: ActivityRow[]
  recorded: FeedbackInput[]
  recomputed: string[]
}

function bench(sessions: CandidateSession[] = [], sessionId: number | null = null): Bench {
  const stored: StoredRun[] = [
    { id: 7, sessionId, status: RunStatus.Live, date: TODAY, startedAt: new Date(T0), fixes: [] },
  ]
  const closed: (ClosedRun & { runId: number })[] = []
  const saved: ActivityRow[] = []
  const recorded: FeedbackInput[] = []
  const recomputed: string[] = []
  const captured: CapturedOuting[] = []

  return {
    stored,
    closed,
    saved,
    recorded,
    recomputed,
    runs: {
      liveRun: async () => stored.find((run) => run.status === RunStatus.Live),
      openRun: async (input) => {
        const run = { id: stored.length + 7, status: RunStatus.Live, fixes: [], ...input }
        stored.push(run)
        return run
      },
      loadRun: async (runId) => stored.find((run) => run.id === runId),
      saveFixes: async (runId, next) => {
        const run = stored.find((item) => item.id === runId)!
        run.fixes = next
      },
      closeRun: async (runId, input) => {
        const run = stored.find((item) => item.id === runId)!
        run.status = input.status
        closed.push({ runId, ...input })
      },
    },
    activities: {
      knownExternalIds: async () => [],
      capturedOutings: async () => captured,
      maxHeartRate: async () => 185,
      candidateSessions: async () => sessions,
      saveActivity: async (row) => {
        saved.push(row)
        return saved.length * 100
      },
      sessionCode: async () => 'seuil',
      sessionSport: async () => Sport.Running,
      recomputeLoad: async (date) => void recomputed.push(date),
    },
    feedback: {
      sessionDate: async () => TODAY,
      saveFeedback: async (input) => void recorded.push(input),
      markDone: async () => {},
      recomputeLoad: async (date) => {
        recomputed.push(date)
        return { date, runningUa: 0, cyclingUa: 0, strengthUa: 0, otherUa: 0, totalUa: 0 }
      },
      evaluateRules: async () => [],
      markSkipped: async () => {},
    },
  }
}

const FEELING = {
  rpe: 7,
  sensations: [Sensation.HeavyLegs],
  sleepHours: 7.5,
  pain: null,
  notes: null,
  correctedDistanceM: null,
  correctedDurationMin: null,
}

describe('sortie courue dans l’app (§ 9, P10)', () => {
  it('rend la sortie déjà ouverte au lieu d’en ouvrir une deuxième', async () => {
    const tools = bench()
    const run = await startRun(tools.runs, {
      sessionId: 42,
      date: TODAY,
      startedAt: new Date(T0),
    })

    expect(run.id).toBe(7)
    expect(tools.stored).toHaveLength(1)
  })

  it('écrit les relevés au fil de la sortie et les dédoublonne', async () => {
    const tools = bench()
    await checkpointRun(tools.runs, 7, fixes(60))
    const track = await checkpointRun(tools.runs, 7, fixes(120))

    expect(tools.stored[0]!.fixes).toHaveLength(121)
    expect(track.elapsedS).toBe(120)
  })

  it('enregistre la sortie en séance faite, ressenti compris', async () => {
    const tools = bench([{ id: 42, date: TODAY, sport: Sport.Running, alreadyMatched: false }], 42)
    const result = await finishRun({ ...tools }, fixedClock(TODAY), {
      runId: 7,
      fixes: fixes(600),
      ...FEELING,
    })

    expect(result.sessionId).toBe(42)
    expect(result.sessionCode).toBe('seuil')
    expect(result.distanceM).toBeGreaterThan(1900)

    expect(tools.saved[0]).toMatchObject({
      externalId: 'cockpit:7',
      sport: Sport.Running,
      date: TODAY,
      sessionId: 42,
      rpe: 7,
    })
    expect(tools.recorded[0]).toMatchObject({ sessionId: 42, rpe: 7, sleepHours: 7.5 })
    expect(tools.closed[0]).toMatchObject({ runId: 7, status: RunStatus.Finished, activityId: 100 })
  })

  it('rattache une sortie libre à la séance du jour, comme un fichier de montre', async () => {
    const tools = bench([{ id: 42, date: TODAY, sport: Sport.Running, alreadyMatched: false }])
    const result = await finishRun({ ...tools }, fixedClock(TODAY), {
      runId: 7,
      fixes: fixes(600),
      ...FEELING,
    })

    expect(result.sessionId).toBe(42)
  })

  it('laisse une sortie libre hors plan quand rien ne l’attend', async () => {
    const tools = bench()
    const result = await finishRun({ ...tools }, fixedClock(TODAY), {
      runId: 7,
      fixes: fixes(600),
      ...FEELING,
    })

    expect(result.sessionId).toBeNull()
    expect(tools.recorded).toHaveLength(0)
    expect(tools.recomputed).toEqual([TODAY])
  })

  it('préfère le réalisé corrigé à la main à la mesure du GPS', async () => {
    const tools = bench()
    const result = await finishRun({ ...tools }, fixedClock(TODAY), {
      runId: 7,
      fixes: fixes(600),
      ...FEELING,
      correctedDistanceM: 2500,
      correctedDurationMin: 11,
    })

    expect(result).toMatchObject({ distanceM: 2500, durationS: 660 })
  })

  it('refuse d’enregistrer une sortie trop courte', async () => {
    const tools = bench()
    await expect(
      finishRun({ ...tools }, fixedClock(TODAY), { runId: 7, fixes: fixes(60), ...FEELING }),
    ).rejects.toThrow('trop courte')
  })

  it('n’enregistre rien quand la sortie est abandonnée', async () => {
    const tools = bench()
    await checkpointRun(tools.runs, 7, fixes(600))
    await abandonRun(tools.runs, 7)

    expect(tools.closed[0]).toMatchObject({ status: RunStatus.Abandoned, activityId: null })
    expect(tools.saved).toHaveLength(0)
    expect(tools.recomputed).toHaveLength(0)
  })

  it('refuse de terminer deux fois la même sortie', async () => {
    const tools = bench()
    await abandonRun(tools.runs, 7)

    await expect(
      finishRun({ ...tools }, fixedClock(TODAY), { runId: 7, fixes: fixes(600), ...FEELING }),
    ).rejects.toThrow('déjà close')
  })
})
