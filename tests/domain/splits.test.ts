import { describe, expect, it } from 'vitest'
import { RunSessionCode, prescription } from '~~/server/domain/running/session-types'
import {
  averagePrescribedPace,
  hasSeveralPaces,
  isSlotOf,
  keyStepPace,
  splitSlots,
} from '~~/server/domain/running/splits'

/** Les prescriptions du moteur au plancher de Ronan : E à 7:05, plage lente 8:05, M à 6:25. */
const context = { vdot: 33.15, weeklyVolumeM: 30_000, phaseProgress: 0.5 }
const progressive = prescription(RunSessionCode.Progressive, context)
const vma = prescription(RunSessionCode.Vma, context)
const endurance = prescription(RunSessionCode.Endurance, context)

describe('les portions à chronométrer', () => {
  it('donne une portion par tiers d’un progressif', () => {
    expect(splitSlots(progressive).map((slot) => slot.label)).toEqual([
      'Premier tiers',
      'Deuxième tiers',
      'Dernier tiers',
    ])
  })

  it('déplie les fractions d’une VMA, sans leurs récupérations', () => {
    const fractions = vma.steps[1]!.repeats!
    const slots = splitSlots(vma)

    expect(slots).toHaveLength(fractions + 2)
    expect(slots.filter((slot) => slot.step === 1).map((slot) => slot.rep)).toEqual(
      Array.from({ length: fractions }, (_, rep) => rep),
    )
  })

  it('refuse une portion que la structure n’a pas', () => {
    expect(isSlotOf(progressive, { step: 2, rep: 0, distanceM: 1500, durationS: 580 })).toBe(true)
    expect(isSlotOf(progressive, { step: 2, rep: 1, distanceM: 1500, durationS: 580 })).toBe(false)
    expect(isSlotOf(progressive, { step: 3, rep: 0, distanceM: 1500, durationS: 580 })).toBe(false)
  })
})

describe('l’allure tenue sur l’étape clé', () => {
  it('lit le dernier tiers d’un progressif, pas la moyenne des trois', () => {
    const splits = [
      { step: 0, rep: 0, distanceM: 1500, durationS: 720 },
      { step: 1, rep: 0, distanceM: 1500, durationS: 630 },
      { step: 2, rep: 0, distanceM: 1500, durationS: 570 },
    ]
    expect(keyStepPace(progressive, splits)).toBe(380)
  })

  it('lit les fractions d’une VMA ensemble, à leur allure moyenne', () => {
    const splits = [
      { step: 0, rep: 0, distanceM: 2000, durationS: 860 },
      { step: 1, rep: 0, distanceM: 800, durationS: 256 },
      { step: 1, rep: 1, distanceM: 800, durationS: 264 },
    ]
    expect(keyStepPace(vma, splits)).toBe(325)
  })

  it('ne dit rien quand l’étape clé n’a pas été chronométrée', () => {
    expect(keyStepPace(progressive, [{ step: 0, rep: 0, distanceM: 1500, durationS: 720 }])).toBe(
      null,
    )
  })
})

describe('l’allure moyenne prescrite', () => {
  it('pondère les tiers d’un progressif par leur distance', () => {
    const [first, second, last] = progressive.steps.map((step) => step.paceSecPerKm!)
    expect(averagePrescribedPace(progressive)).toBeCloseTo((first! + second! + last!) / 3, 0)
  })

  it('sait qu’une séance à une seule allure n’en a qu’une', () => {
    expect(hasSeveralPaces(endurance)).toBe(false)
    expect(hasSeveralPaces(progressive)).toBe(true)
  })
})
