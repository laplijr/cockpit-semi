import { describe, expect, it } from 'vitest'
import type { PlanSession } from '~/stores/plan'
import { isAwaitingFeedback, sessionFigures } from '~/utils/session-figures'

/**
 * Les trois chiffres d'une séance sont ceux de son sport (§ 8, P11.1) : une
 * séance de renforcement décrite par une distance et une allure cible n'était
 * pas décrite, elle disait ce qu'elle n'avait pas.
 */
function session(overrides: Partial<PlanSession> = {}): PlanSession {
  return {
    id: 1,
    weekId: 1,
    date: '2026-11-24',
    sport: 'course',
    code: 'EF',
    key: false,
    status: 'prevue',
    origin: 'moteur',
    actualDurationMin: null,
    actualDistanceM: null,
    feedbackRpe: null,
    prescription: {
      label: 'Endurance',
      totalDistanceM: 10_000,
      expectedRpe: 4,
      steps: [{ label: 'Endurance', distanceM: 10_000, paceSecPerKm: 419 }],
    },
    ...overrides,
  }
}

const strength = () =>
  session({
    sport: 'muscu',
    code: 'legs',
    prescription: {
      label: 'Legs',
      totalDistanceM: 0,
      expectedRpe: 7,
      durationMin: 50,
      steps: [
        { label: 'Squat arrière', exerciseId: 'squat_arriere', repeats: 4, reps: 6 },
        { label: 'Soulevé de terre roumain', exerciseId: 'sdt_roumain', repeats: 3, reps: 8 },
        { label: 'Mollets', exerciseId: 'mollets', repeats: 3, reps: 12 },
      ],
    },
  })

describe('les trois chiffres du sport', () => {
  it('décrit une course par sa distance, sa durée et son allure cible', () => {
    expect(sessionFigures(session()).map((figure) => [figure.label, figure.value])).toEqual([
      ['distance', '10 km'],
      ['durée', '1 h 10'],
      ['allure cible', '6:59/km'],
    ])
  })

  it('prend l’allure des fractions d’une séance de qualité, pas celle de l’échauffement (P19)', () => {
    const vma = session({
      code: 'VMA',
      key: true,
      prescription: {
        label: 'VMA',
        totalDistanceM: 5000,
        expectedRpe: 8,
        steps: [
          { label: 'Échauffement', distanceM: 2000, paceSecPerKm: 419 },
          {
            label: 'Fraction',
            repeats: 4,
            distanceM: 500,
            paceSecPerKm: 323,
            recoveryS: 150,
            intense: true,
          },
          { label: 'Retour au calme', distanceM: 1000, paceSecPerKm: 419 },
        ],
      },
    })
    expect(sessionFigures(vma).find((figure) => figure.key === 'trois')?.value).toBe('5:23/km')
  })

  it('décrit un renforcement par sa durée, ses exercices et l’effort attendu', () => {
    const figures = sessionFigures(strength())

    expect(figures.map((figure) => [figure.label, figure.value])).toEqual([
      ['durée', '50′'],
      ['exercices', '3'],
      ['effort attendu', 'RPE 7'],
    ])
    expect(figures.some((figure) => figure.value === '—')).toBe(false)
  })

  it('décrit une sortie vélo par son intensité', () => {
    const ride = session({
      sport: 'velo',
      code: 'Z2',
      prescription: {
        label: 'Endurance Z2',
        totalDistanceM: 45_000,
        expectedRpe: 3,
        durationMin: 90,
        steps: [{ label: 'Z2', durationS: 5400, intensity: 'Z2' }],
      },
    })

    expect(sessionFigures(ride).map((figure) => figure.label)).toEqual([
      'distance',
      'durée',
      'intensité',
    ])
    expect(sessionFigures(ride)[2]!.value).toBe('Z2')
  })

  it('passe au réalisé quand la séance est faite, le prescrit dessous là où il diffère', () => {
    const figures = sessionFigures(
      session({ status: 'faite', actualDistanceM: 9000, actualDurationMin: 70 }),
    )

    expect(figures[0]).toMatchObject({ label: 'distance', value: '9,0 km', planned: '10 km' })
    expect(figures[1]).toMatchObject({ label: 'durée', value: '1 h 10' })
    expect(figures[1]!.planned).toBeUndefined()
    expect(figures[2]).toMatchObject({ label: 'allure tenue', value: '7:47/km' })
  })

  it('rend le RPE ressenti d’un renforcement fait, et garde ses exercices', () => {
    const figures = sessionFigures({
      ...strength(),
      status: 'faite',
      actualDurationMin: 45,
      feedbackRpe: 8,
    })

    expect(figures[0]).toMatchObject({ value: '45′', planned: '50′' })
    expect(figures[1]).toMatchObject({ label: 'exercices', value: '3' })
    expect(figures[2]).toMatchObject({
      label: 'effort ressenti',
      value: 'RPE 8',
      planned: 'RPE 7',
    })
  })

  it('garde le prescrit quand une séance faite n’a aucune mesure', () => {
    expect(sessionFigures(session({ status: 'faite' }))[0]).toMatchObject({
      label: 'distance',
      value: '10 km',
    })
  })
})

describe('une séance passée qui attend son retour (P20)', () => {
  it('attend son retour, prévue ou modifiée (P28)', () => {
    expect(isAwaitingFeedback(session({ date: '2026-11-20' }), '2026-11-24')).toBe(true)
    expect(
      isAwaitingFeedback(session({ date: '2026-11-20', status: 'modifiee' }), '2026-11-24'),
    ).toBe(true)
  })

  it('n’attend rien une fois faite, ou le jour même', () => {
    expect(isAwaitingFeedback(session({ date: '2026-11-20', status: 'faite' }), '2026-11-24')).toBe(
      false,
    )
    expect(isAwaitingFeedback(session({ status: 'modifiee' }), '2026-11-24')).toBe(false)
  })
})
