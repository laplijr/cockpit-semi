import { describe, expect, it } from 'vitest'
import { declareFitness } from '~~/server/application/declare-fitness'
import {
  ONBOARDING_STEPS,
  OnboardingStep,
  isUntouched,
  resumeStep,
  type OnboardingState,
} from '~~/server/domain/athlete/onboarding'
import { FitnessDeclaration } from '~~/server/domain/fitness/declaration'
import { FitnessOrigin } from '~~/server/domain/fitness/fitness-point'
import { vdotFromEasyPace, vdotFromRace } from '~~/server/domain/fitness/vdot'

const NOTHING: OnboardingState = {
  hasIdentity: false,
  hasLevel: false,
  hasFitness: false,
  hasObjective: false,
  hasConstraints: false,
}

const EVERYTHING: OnboardingState = {
  hasIdentity: true,
  hasLevel: true,
  hasFitness: true,
  hasObjective: true,
  hasConstraints: true,
}

describe('reprise de l’onboarding (§ 9, P8.2)', () => {
  it('enchaîne six écrans, l’accueil en tête', () => {
    expect(ONBOARDING_STEPS).toHaveLength(6)
    expect(ONBOARDING_STEPS[0]).toBe(OnboardingStep.Welcome)
    expect(ONBOARDING_STEPS.at(-1)).toBe(OnboardingStep.Schedule)
  })

  it('reconnaît une base neuve : rien n’a encore été écrit', () => {
    expect(isUntouched(NOTHING)).toBe(true)
    expect(isUntouched({ ...NOTHING, hasIdentity: true })).toBe(false)
  })

  it('reprend au premier écran dont la trace manque', () => {
    expect(resumeStep(NOTHING)).toBe(OnboardingStep.Identity)
    expect(resumeStep({ ...NOTHING, hasIdentity: true })).toBe(OnboardingStep.Level)
    expect(resumeStep({ ...EVERYTHING, hasFitness: false })).toBe(OnboardingStep.Fitness)
    expect(resumeStep({ ...EVERYTHING, hasObjective: false })).toBe(OnboardingStep.Objective)
    expect(resumeStep({ ...EVERYTHING, hasConstraints: false })).toBe(OnboardingStep.Schedule)
  })

  it('laisse l’écran des contraintes en dernier, même tout rempli', () => {
    expect(resumeStep(EVERYTHING)).toBe(OnboardingStep.Schedule)
  })

  it('ne saute pas un écran manquant plus tôt qu’un autre', () => {
    const halfway = { ...NOTHING, hasIdentity: true, hasConstraints: true }
    expect(resumeStep(halfway)).toBe(OnboardingStep.Level)
  })
})

describe('VDOT de départ déclaré (§ 5, P8.1)', () => {
  function recorder() {
    const points: Parameters<Parameters<typeof declareFitness>[0]['saveFitnessPoint']>[0][] = []
    return {
      points,
      gateway: {
        async saveFitnessPoint(point: (typeof points)[number]) {
          points.push(point)
        },
      },
    }
  }

  it('écrit un point mesuré depuis un chrono déclaré', async () => {
    const { points, gateway } = recorder()
    const declared = await declareFitness(gateway, '2026-09-16', {
      kind: FitnessDeclaration.Chrono,
      distanceM: 10_000,
      timeS: 56 * 60 + 40,
      date: '2026-06-21',
    })

    expect(declared).toEqual({ vdot: vdotFromRace(10_000, 56 * 60 + 40), isFloor: false })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      date: '2026-06-21',
      origin: FitnessOrigin.InitialImport,
      isFloor: false,
    })
  })

  it('écrit un plancher depuis une allure d’endurance déclarée', async () => {
    const { points, gateway } = recorder()
    const declared = await declareFitness(gateway, '2026-09-16', {
      kind: FitnessDeclaration.EasyPace,
      paceSecPerKm: 6 * 60 + 47,
    })

    expect(declared!.vdot).toBeCloseTo(vdotFromEasyPace(407), 0)
    expect(declared!.isFloor).toBe(true)
    expect(points[0]).toMatchObject({
      date: '2026-09-16',
      origin: FitnessOrigin.Declared,
      isFloor: true,
    })
  })

  it('n’écrit rien quand la réponse est « je ne sais pas »', async () => {
    const { points, gateway } = recorder()
    const declared = await declareFitness(gateway, '2026-09-16', {
      kind: FitnessDeclaration.Unknown,
    })

    expect(declared).toBeUndefined()
    expect(points).toEqual([])
  })
})
