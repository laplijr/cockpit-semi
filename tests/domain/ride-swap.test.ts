import { describe, expect, it } from 'vitest'
import { TrainingZone, paceFor } from '~~/server/domain/fitness/vdot'
import {
  replaceRideWithRun,
  rideSwapRefusal,
  type SwappableSession,
} from '~~/server/domain/plan/ride-swap'
import { EASY_MIN_MIN } from '~~/server/domain/plan/week-template'
import { SessionStatus } from '~~/server/domain/plan/session'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import type { Prescription } from '~~/server/domain/shared/prescription'
import { Sport } from '~~/server/domain/shared/sport'

const VDOT = 35
const TARGET_RUN_M = 40_000
const EASY_PACE = paceFor(VDOT, TrainingZone.Easy)
const MIN_EASY_M = Math.round((EASY_MIN_MIN * 60 * 1000) / EASY_PACE)

/** Sortie Z2 de 1 h 30 à RPE 3 : la séance de vélo la plus courante du plan. */
function ride(date = '2026-11-18'): SwappableSession {
  return {
    id: 1,
    date,
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
}

function easyRun(id: number, date: string, distanceM: number, strides = false): SwappableSession {
  const steps = [{ label: 'Endurance', distanceM, paceSecPerKm: EASY_PACE }]
  const prescription: Prescription = {
    code: RunSessionCode.Endurance,
    label: 'Endurance fondamentale',
    totalDistanceM: strides ? distanceM + 600 : distanceM,
    qualityDistanceM: strides ? 600 : 0,
    expectedRpe: 3,
    steps: strides
      ? [...steps, { label: 'Lignes droites', intense: true, repeats: 6, distanceM: 100 }]
      : steps,
  }

  return {
    id,
    date,
    sport: Sport.Running,
    code: RunSessionCode.Endurance,
    status: SessionStatus.Planned,
    key: false,
    prescription,
  }
}

function longRun(id: number, date: string, distanceM = 12_000): SwappableSession {
  return {
    id,
    date,
    sport: Sport.Running,
    code: RunSessionCode.LongRun,
    status: SessionStatus.Planned,
    key: true,
    prescription: {
      code: RunSessionCode.LongRun,
      label: 'Sortie longue',
      totalDistanceM: distanceM,
      qualityDistanceM: 0,
      expectedRpe: 4,
      steps: [{ label: 'Sortie longue', distanceM, paceSecPerKm: EASY_PACE }],
    },
  }
}

/** Mercredi de vélo, deux endurances après lui, la sortie longue le dimanche. */
function week(): SwappableSession[] {
  return [
    ride(),
    easyRun(2, '2026-11-19', 9000),
    easyRun(3, '2026-11-21', 8000),
    longRun(4, '2026-11-22'),
  ]
}

function runningVolume(sessions: SwappableSession[]): number {
  return sessions
    .filter((item) => item.sport === Sport.Running)
    .reduce((total, item) => total + item.prescription.totalDistanceM, 0)
}

describe('quand une séance de vélo se remplace (§ 5, P6.42)', () => {
  it('refuse la veille et le lendemain', () => {
    expect(rideSwapRefusal(ride(), '2026-11-17')).toMatch(/jour même/)
    expect(rideSwapRefusal(ride(), '2026-11-19')).toMatch(/jour même/)
    expect(rideSwapRefusal(ride(), '2026-11-18')).toBeUndefined()
  })

  it('refuse une séance qui n’est pas du vélo', () => {
    const run = easyRun(2, '2026-11-18', 9000)
    expect(rideSwapRefusal(run, '2026-11-18')).toMatch(/séance de vélo/)
  })

  it('refuse une séance déjà faite ou déjà remplacée', () => {
    const done = { ...ride(), status: SessionStatus.Done }
    const modified = { ...ride(), status: SessionStatus.Modified }

    expect(rideSwapRefusal(done, '2026-11-18')).toMatch(/plus à faire/)
    expect(rideSwapRefusal(modified, '2026-11-18')).toMatch(/plus à faire/)
  })
})

describe('endurance de remplacement et volume rendu (§ 5, P6.42)', () => {
  it('garde le volume de course de la semaine au mètre près', () => {
    const sessions = week()
    const swap = replaceRideWithRun({
      ride: ride(),
      weekSessions: sessions,
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    const taken = swap.givebacks.reduce((total, item) => total + item.takenM, 0)
    expect(swap.prescription.totalDistanceM).toBe(taken)

    const after = sessions.map((item) => {
      const giveback = swap.givebacks.find((entry) => entry.sessionId === item.id)
      return giveback ? { ...item, prescription: giveback.after } : item
    })
    expect(runningVolume(after) + swap.prescription.totalDistanceM).toBe(runningVolume(sessions))
  })

  it('ne descend aucune endurance sous son plancher de 35′', () => {
    const swap = replaceRideWithRun({
      ride: ride(),
      weekSessions: week(),
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    for (const giveback of swap.givebacks) {
      const easy = giveback.after.steps.find((step) => !step.intense)!
      expect(easy.distanceM).toBeGreaterThanOrEqual(MIN_EASY_M)
    }
    expect(swap.prescription.totalDistanceM).toBeGreaterThanOrEqual(MIN_EASY_M)
  })

  it('ne touche ni la sortie longue ni les séances déjà passées', () => {
    const sessions = [...week(), easyRun(5, '2026-11-16', 9000)]
    const swap = replaceRideWithRun({
      ride: ride(),
      weekSessions: sessions,
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    expect(swap.givebacks.map((item) => item.sessionId).sort()).toEqual([2, 3])
  })

  /** Les lignes droites sont l'intensité de la séance : on raccourcit le facile. */
  it('laisse les lignes droites entières', () => {
    const sessions = [ride(), easyRun(2, '2026-11-19', 9000, true), easyRun(3, '2026-11-21', 8000)]
    const swap = replaceRideWithRun({
      ride: ride(),
      weekSessions: sessions,
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    const strided = swap.givebacks.find((item) => item.sessionId === 2)!
    expect(strided.after.steps.find((step) => step.intense)).toEqual(
      sessions[1]!.prescription.steps.find((step) => step.intense),
    )
    expect(strided.after.qualityDistanceM).toBe(600)
  })

  it('ramène l’endurance au plancher le lendemain de la sortie longue', () => {
    const sessions = [
      longRun(4, '2026-11-17'),
      ride(),
      easyRun(2, '2026-11-19', 9000),
      easyRun(3, '2026-11-21', 8000),
    ]

    const swap = replaceRideWithRun({
      ride: ride(),
      weekSessions: sessions,
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    expect(swap.cappedAfterLongRun).toBe(true)
    expect(swap.prescription.totalDistanceM).toBe(MIN_EASY_M)
  })

  /** Le vélo du lundi suit la sortie longue du dimanche, semaine précédente. */
  it('voit la sortie longue de la veille même hors de la semaine', () => {
    const monday = ride('2026-11-23')
    const sessions = [monday, easyRun(2, '2026-11-26', 9000), easyRun(3, '2026-11-27', 8000)]

    const withoutEve = replaceRideWithRun({
      ride: monday,
      weekSessions: sessions,
      previousDay: [],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!
    const withEve = replaceRideWithRun({
      ride: monday,
      weekSessions: sessions,
      previousDay: [longRun(4, '2026-11-22')],
      targetRunM: TARGET_RUN_M,
      vdot: VDOT,
    })!

    expect(withoutEve.cappedAfterLongRun).toBe(false)
    expect(withEve.cappedAfterLongRun).toBe(true)
    expect(withEve.prescription.totalDistanceM).toBe(MIN_EASY_M)
    expect(withEve.prescription.totalDistanceM).toBeLessThan(withoutEve.prescription.totalDistanceM)
  })

  it('ne remplace rien quand la semaine n’a plus 35′ à prêter', () => {
    const sessions = [ride(), longRun(4, '2026-11-22'), easyRun(2, '2026-11-16', 9000)]

    expect(
      replaceRideWithRun({
        ride: ride(),
        weekSessions: sessions,
        previousDay: [],
        targetRunM: TARGET_RUN_M,
        vdot: VDOT,
      }),
    ).toBeUndefined()
  })
})
