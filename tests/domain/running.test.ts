import { describe, expect, it } from 'vitest'
import { PhaseType } from '~~/server/domain/plan/phases'
import {
  RUN_SESSION_TYPES,
  RunSessionCode,
  isAllowedInPhase,
  maxDistanceFor,
  prescription,
  respectsQuota,
} from '~~/server/domain/running/session-types'

const WEEKLY_VOLUME_M = 40_000
const VDOT = 33.15

describe('bibliothèque des séances de course', () => {
  it('contient les neuf types du § 8', () => {
    expect(Object.keys(RUN_SESSION_TYPES)).toHaveLength(9)
  })

  it('donne à chaque type un RPE attendu cohérent avec son intensité', () => {
    expect(RUN_SESSION_TYPES[RunSessionCode.Endurance].expectedRpe).toBeLessThan(
      RUN_SESSION_TYPES[RunSessionCode.Threshold].expectedRpe,
    )
    expect(RUN_SESSION_TYPES[RunSessionCode.Threshold].expectedRpe).toBeLessThan(
      RUN_SESSION_TYPES[RunSessionCode.Vma].expectedRpe,
    )
  })
})

describe('quotas (§ 8)', () => {
  it('plafonne la VMA à 8 % du volume hebdomadaire', () => {
    expect(maxDistanceFor(RunSessionCode.Vma, WEEKLY_VOLUME_M)).toBe(3200)
    expect(respectsQuota(RunSessionCode.Vma, 3200, WEEKLY_VOLUME_M)).toBe(true)
    expect(respectsQuota(RunSessionCode.Vma, 3300, WEEKLY_VOLUME_M)).toBe(false)
  })

  it('plafonne le seuil à 10 % du volume hebdomadaire', () => {
    expect(maxDistanceFor(RunSessionCode.Threshold, WEEKLY_VOLUME_M)).toBe(4000)
    expect(respectsQuota(RunSessionCode.Threshold, 4100, WEEKLY_VOLUME_M)).toBe(false)
  })

  it('plafonne la sortie longue à 30 % du volume hebdomadaire', () => {
    expect(maxDistanceFor(RunSessionCode.LongRun, WEEKLY_VOLUME_M)).toBe(12_000)
    expect(respectsQuota(RunSessionCode.LongRun, 12_500, WEEKLY_VOLUME_M)).toBe(false)
  })

  it('ne plafonne pas l’endurance fondamentale', () => {
    expect(maxDistanceFor(RunSessionCode.Endurance, WEEKLY_VOLUME_M)).toBeUndefined()
    expect(respectsQuota(RunSessionCode.Endurance, 99_000, WEEKLY_VOLUME_M)).toBe(true)
  })
})

describe('phases autorisées', () => {
  it('interdit la VMA en base : elle n’arrive qu’au développement', () => {
    expect(isAllowedInPhase(RunSessionCode.Vma, PhaseType.Base)).toBe(false)
    expect(isAllowedInPhase(RunSessionCode.Vma, PhaseType.Development)).toBe(true)
  })

  it('réserve l’allure semi aux phases spécifique et affûtage', () => {
    expect(isAllowedInPhase(RunSessionCode.HalfPace, PhaseType.Base)).toBe(false)
    expect(isAllowedInPhase(RunSessionCode.HalfPace, PhaseType.Specific)).toBe(true)
  })

  it('autorise le test dans toutes les phases', () => {
    for (const phase of Object.values(PhaseType)) {
      expect(isAllowedInPhase(RunSessionCode.Test, phase)).toBe(true)
    }
  })
})

describe('prescription', () => {
  const context = { vdot: VDOT, weeklyVolumeM: WEEKLY_VOLUME_M }

  it('respecte le quota du type qu’elle prescrit', () => {
    for (const code of Object.values(RunSessionCode)) {
      const result = prescription(code, context)
      expect(respectsQuota(code, result.totalDistanceM, WEEKLY_VOLUME_M)).toBe(true)
    }
  })

  it('prescrit des fractions VMA plus rapides que l’endurance', () => {
    const vma = prescription(RunSessionCode.Vma, context)
    const easy = prescription(RunSessionCode.Endurance, context)
    const fractions = vma.steps.find((step) => step.label === 'Fractions')
    expect(fractions!.paceSecPerKm!).toBeLessThan(easy.steps[0]!.paceSecPerKm!)
  })

  it('encadre les séances à intensité d’un échauffement et d’un retour au calme', () => {
    for (const code of [RunSessionCode.Threshold, RunSessionCode.Vma, RunSessionCode.Hills]) {
      const steps = prescription(code, context).steps
      expect(steps[0]!.label).toBe('Échauffement')
      expect(steps.at(-1)!.label).toBe('Retour au calme')
    }
  })

  it('construit un progressif dont chaque tiers est plus rapide que le précédent', () => {
    const steps = prescription(RunSessionCode.Progressive, context).steps
    expect(steps[1]!.paceSecPerKm!).toBeLessThan(steps[0]!.paceSecPerKm!)
    expect(steps[2]!.paceSecPerKm!).toBeLessThan(steps[1]!.paceSecPerKm!)
  })
})
