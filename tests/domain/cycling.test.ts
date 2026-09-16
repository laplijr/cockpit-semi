import { describe, expect, it } from 'vitest'
import { cyclingCodeFor, toCyclingPrescription } from '~~/server/domain/cycling/convert'
import {
  CYCLE_SESSION_TYPES,
  CycleSessionCode,
  cyclingPrescription,
  plannableCycleSessions,
} from '~~/server/domain/cycling/session-types'
import { PhaseType } from '~~/server/domain/plan/phases'
import { RunSessionCode, prescription } from '~~/server/domain/running/session-types'
import { prescribedDurationMin, prescribedUnits } from '~~/server/domain/shared/prescription'

const VDOT = 33.15
const CONTEXT = { vdot: VDOT, weeklyVolumeM: 35_000 }

describe('bibliothèque vélo (§ 8)', () => {
  it('borne la durée d’un Z2 entre 75 et 120 minutes', () => {
    expect(prescribedDurationMin(cyclingPrescription(CycleSessionCode.EnduranceZ2, 30))).toBe(75)
    expect(prescribedDurationMin(cyclingPrescription(CycleSessionCode.EnduranceZ2, 300))).toBe(120)
    expect(prescribedDurationMin(cyclingPrescription(CycleSessionCode.EnduranceZ2, 90))).toBe(90)
  })

  it('ne laisse jamais le générateur poser un sweet spot : douleur seulement (§ 5)', () => {
    expect(CYCLE_SESSION_TYPES[CycleSessionCode.SweetSpot].onPainOnly).toBe(true)
    for (const phase of Object.values(PhaseType)) {
      expect(plannableCycleSessions(phase)).not.toContain(CycleSessionCode.SweetSpot)
    }
  })

  it('coupe la sortie longue vélo dès la phase spécifique (§ 5)', () => {
    expect(plannableCycleSessions(PhaseType.Base)).toContain(CycleSessionCode.LongRide)
    expect(plannableCycleSessions(PhaseType.Specific)).not.toContain(CycleSessionCode.LongRide)
  })
})

describe('conversion course → vélo (§ 5, R8)', () => {
  it('conserve la charge à ± 10 %', () => {
    for (const code of [
      RunSessionCode.Endurance,
      RunSessionCode.LongRun,
      RunSessionCode.Threshold,
    ]) {
      const run = prescription(code, CONTEXT)
      const ride = toCyclingPrescription(run)
      const drift = Math.abs(prescribedUnits(ride) - prescribedUnits(run)) / prescribedUnits(run)
      expect(drift).toBeLessThanOrEqual(0.1)
    }
  })

  it('allonge la séance quand le vélo se roule à un RPE plus bas', () => {
    const run = prescription(RunSessionCode.LongRun, CONTEXT)
    const ride = toCyclingPrescription(run)
    expect(prescribedDurationMin(ride)).toBeGreaterThan(prescribedDurationMin(run))
  })

  it('remplace un seuil par un sweet spot et tout le reste par du Z2', () => {
    expect(cyclingCodeFor(RunSessionCode.Threshold)).toBe(CycleSessionCode.SweetSpot)
    expect(cyclingCodeFor(RunSessionCode.LongRun)).toBe(CycleSessionCode.EnduranceZ2)
    expect(cyclingCodeFor(RunSessionCode.Vma)).toBe(CycleSessionCode.EnduranceZ2)
  })
})
