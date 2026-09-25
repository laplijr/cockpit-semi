import { describe, expect, it } from 'vitest'
import { WorkoutStepKind } from '~~/server/domain/watch/workout'
import { speakLine, stepBlockLines, targetLine } from '~/utils/step-lines'

const fraction = {
  kind: WorkoutStepKind.Active,
  label: 'Fractions',
  distanceM: 500,
  paceSecPerKm: 323,
}
const recovery = { kind: WorkoutStepKind.Recovery, label: 'Récupération', durationS: 150 }

describe('les étapes de l’écran de course (§ 9, P10)', () => {
  it('dit une étape par sa taille et ce qu’il y a à tenir', () => {
    expect(targetLine(fraction)).toBe('500 m à 5:23/km')
    expect(
      targetLine({ kind: WorkoutStepKind.Active, label: 'Côtes', durationS: 60, rpe: 8 }),
    ).toBe('1′ à RPE 8')
  })

  it('replie un bloc répété en une ligne, la récupération sans allure', () => {
    expect(stepBlockLines([{ repeats: 4, steps: [fraction, recovery] }])).toEqual([
      { label: 'Fractions', line: '4 × (500 m à 5:23/km + récup 2′30)' },
    ])
  })

  it('garde une ligne par étape hors répétition', () => {
    const warmup = { kind: WorkoutStepKind.Warmup, label: 'Échauffement', distanceM: 2000 }
    expect(stepBlockLines([{ repeats: 1, steps: [warmup] }])).toHaveLength(1)
  })

  it('dit la même étape à voix haute, sans prime ni deux points', () => {
    expect(speakLine(fraction)).toBe('500 mètres à 5 minutes 23 secondes au kilomètre')
  })
})
