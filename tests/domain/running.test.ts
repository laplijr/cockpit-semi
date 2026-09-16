import { describe, expect, it } from 'vitest'
import { halfMarathonPace } from '~~/server/domain/fitness/vdot'
import { PhaseType } from '~~/server/domain/plan/phases'
import {
  QuotaBasis,
  RUN_SESSION_TYPES,
  RunSessionCode,
  quotaBasisFor,
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

  it('respecte le quota du type qu’elle prescrit, sur la bonne assiette', () => {
    for (const code of Object.values(RunSessionCode)) {
      const result = prescription(code, context)
      const measured =
        quotaBasisFor(code) === QuotaBasis.Total ? result.totalDistanceM : result.qualityDistanceM
      expect(respectsQuota(code, measured, WEEKLY_VOLUME_M)).toBe(true)
    }
  })

  it('compte l’échauffement dans le total mais jamais dans le quota d’intensité', () => {
    const vma = prescription(RunSessionCode.Vma, context)
    expect(vma.qualityDistanceM).toBeLessThan(vma.totalDistanceM)
    expect(vma.qualityDistanceM).toBeLessThanOrEqual(WEEKLY_VOLUME_M * 0.08)
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

describe('progression des séances clés dans la phase (§ 5)', () => {
  // Volume assez large pour que la progression tienne dans les quotas.
  const at = (code: RunSessionCode, phaseProgress: number, weeklyVolumeM = 70_000) =>
    prescription(code, { vdot: 40, weeklyVolumeM, phaseProgress })

  it('fait croître strictement le volume de qualité de la VMA', () => {
    const volumes = [0, 0.5, 1].map((progress) => at(RunSessionCode.Vma, progress).qualityDistanceM)
    expect(volumes[1]!).toBeGreaterThan(volumes[0]!)
    expect(volumes[2]!).toBeGreaterThan(volumes[1]!)
  })

  it('suit la séquence VMA 4×800 → 6×800 → 5×1000', () => {
    const fractions = [0, 0.5, 1]
      .map((progress) =>
        at(RunSessionCode.Vma, progress).steps.find((s) => s.label === 'Fractions')!,
      )
      .map((step) => [step.repeats, step.distanceM])
    expect(fractions).toEqual([
      [4, 800],
      [6, 800],
      [5, 1000],
    ])
  })

  it('suit la séquence seuil 2×8′ → 3×8′ → 20′ continu', () => {
    const blocks = [0, 0.5, 1]
      .map((progress) =>
        at(RunSessionCode.Threshold, progress).steps.find((s) => s.label === 'Seuil')!,
      )
      .map((step) => [step.repeats, step.durationS])
    expect(blocks).toEqual([
      [2, 480],
      [3, 480],
      [1, 1200],
    ])
  })

  it('atteint au moins 4 km de qualité au seuil sur une semaine à 55 km', () => {
    const peak = Math.max(
      ...[0, 0.5, 1].map(
        (progress) => at(RunSessionCode.Threshold, progress, 55_000).qualityDistanceM,
      ),
    )
    expect(peak).toBeGreaterThanOrEqual(4000)
  })

  it('rabat le palier sur le plus gros qui tienne dans le quota, plutôt que de rien prescrire', () => {
    // Le quota est un plafond, pas un veto (§ 1.4) : sur une petite semaine on
    // court 4 × 800 même en fin de phase, au lieu de supprimer la séance.
    const small = at(RunSessionCode.Vma, 1, 45_000)
    const fractions = small.steps.find((step) => step.label === 'Fractions')!
    expect(fractions.repeats).toBe(4)
    expect(small.qualityDistanceM).toBeLessThanOrEqual(45_000 * 0.08)
  })

  it('fait croître le nombre de côtes de 6 à 10', () => {
    const repeats = [0, 1].map(
      (progress) => at(RunSessionCode.Hills, progress).steps.find((s) => s.intense)!.repeats,
    )
    expect(repeats).toEqual([6, 10])
  })

  it('prescrit les côtes à l’effort, sans allure', () => {
    const hill = at(RunSessionCode.Hills, 0.5).steps.find((step) => step.intense)!
    expect(hill.paceSecPerKm).toBeUndefined()
    expect(hill.durationS).toBe(30)
  })

  it('tire l’allure semi de la projection et non de la zone marathon', () => {
    const step = at(RunSessionCode.HalfPace, 0.5).steps.find((item) => item.intense)!
    expect(step.paceSecPerKm).toBeCloseTo(halfMarathonPace(40), 6)
  })
})
