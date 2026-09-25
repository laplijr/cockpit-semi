import { describe, expect, it } from 'vitest'
import { isPaceHeld } from '~~/server/domain/rules/pace-held'
import { RunSessionCode, prescription } from '~~/server/domain/running/session-types'

/** Les prescriptions du moteur au plancher de Ronan : E à 7:05, seuil à 5:55. */
const context = { vdot: 33.15, weeklyVolumeM: 30_000, phaseProgress: 0.5 }
const longRun = prescription(RunSessionCode.LongRun, context)
const threshold = prescription(RunSessionCode.Threshold, context)

const minutesAt = (paceSecPerKm: number, distanceM: number) =>
  ((distanceM / 1000) * paceSecPerKm) / 60

describe('isPaceHeld', () => {
  it('tient une sortie longue courue plus lentement que l’allure affichée mais dans la zone E', () => {
    expect(
      isPaceHeld({
        prescription: longRun,
        actualDistanceM: longRun.totalDistanceM,
        actualDurationMin: minutesAt(450, longRun.totalDistanceM),
        rpe: 5,
      }),
    ).toBe(true)
  })

  it('ne tient pas une sortie longue courue sous la borne lente de la zone E', () => {
    expect(
      isPaceHeld({
        prescription: longRun,
        actualDistanceM: longRun.totalDistanceM,
        actualDurationMin: minutesAt(510, longRun.totalDistanceM),
        rpe: 5,
      }),
    ).toBe(false)
  })

  it('tient un seuil couru aux allures prescrites, récupérations comprises', () => {
    const seconds = 2000 * 0.425 + 2 * (1352 * 0.355 + 120) + 1000 * 0.425
    expect(
      isPaceHeld({
        prescription: threshold,
        actualDistanceM: threshold.totalDistanceM,
        actualDurationMin: seconds / 60,
        rpe: 7,
      }),
    ).toBe(true)
  })

  it('ne tient pas un seuil nettement ralenti sur la séance entière', () => {
    expect(
      isPaceHeld({
        prescription: threshold,
        actualDistanceM: threshold.totalDistanceM,
        actualDurationMin: minutesAt(500, threshold.totalDistanceM),
        rpe: 7,
      }),
    ).toBe(false)
  })

  it('se replie sur le RPE sans réalisé chiffré', () => {
    const input = { prescription: threshold, actualDistanceM: null, actualDurationMin: null }
    expect(isPaceHeld({ ...input, rpe: threshold.expectedRpe })).toBe(true)
    expect(isPaceHeld({ ...input, rpe: threshold.expectedRpe + 1 })).toBe(false)
  })

  it('se replie sur le RPE pour une séance sans allure', () => {
    const ride = { ...longRun, steps: [{ label: 'Z2', durationS: 3600 }], totalDistanceM: 0 }
    expect(
      isPaceHeld({ prescription: ride, actualDistanceM: 30_000, actualDurationMin: 60, rpe: 9 }),
    ).toBe(false)
  })
})
