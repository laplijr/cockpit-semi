import { describe, expect, it } from 'vitest'
import { strengthIntentOf } from '~~/server/domain/athlete/constraints'
import { PhaseType } from '~~/server/domain/plan/phases'
import { STRENGTH_PER_PHASE, strengthPerPhase } from '~~/server/domain/plan/week-support'
import { StrengthIntent } from '~~/server/domain/strength/intent'
import { StrengthPhase } from '~~/server/domain/strength/phases'
import { strengthExercise } from '~~/server/domain/strength/exercises'
import {
  STRENGTH_CATALOGUE,
  StrengthSessionCode,
  strengthPrescription,
  strengthSessionType,
} from '~~/server/domain/strength/session-types'

/**
 * Push / Pull / Legs n'est pas « la muscu », c'est un programme (§ 5, P11.2).
 * L'intention choisit le catalogue de séances et la table par phase, et rien
 * d'autre : les doses, les repos et les contraintes sont écrits en termes
 * d'exercices et de `lowerBody`.
 */
describe('intention du renforcement', () => {
  it('vaut « complet » tant que rien n’est déclaré : un plan généré ne bouge pas', () => {
    expect(strengthIntentOf({ availableDays: [1, 3, 5] })).toBe(StrengthIntent.Complete)
    expect(strengthPerPhase(StrengthIntent.Complete)).toBe(STRENGTH_PER_PHASE)
  })

  it('pose Appuis et Tronc en base, en développement, en spécifique et en relance', () => {
    const table = strengthPerPhase(StrengthIntent.Running)

    for (const phase of [
      PhaseType.Base,
      PhaseType.ShortBase,
      PhaseType.Development,
      PhaseType.Specific,
      PhaseType.Rebuild,
    ]) {
      expect(table[phase]).toEqual([StrengthSessionCode.Footing, StrengthSessionCode.Core])
    }
  })

  it('remplace Appuis par Puissance en vitesse, et l’affûtage n’a que son rappel', () => {
    const table = strengthPerPhase(StrengthIntent.Running)

    expect(table[PhaseType.Speed]).toEqual([StrengthSessionCode.Power, StrengthSessionCode.Core])
    expect(table[PhaseType.Taper]).toEqual([StrengthSessionCode.Recall])
    expect(table[PhaseType.Recovery]).toEqual([
      StrengthSessionCode.Mobility,
      StrengthSessionCode.Core,
    ])
    expect(table[PhaseType.Transition]).toEqual([])
  })

  it('ne laisse aucune séance de salle de sport dans le catalogue « pour la course »', () => {
    const gym = [
      StrengthSessionCode.Legs,
      StrengthSessionCode.Push,
      StrengthSessionCode.Pull,
      StrengthSessionCode.Full,
    ]

    for (const code of STRENGTH_CATALOGUE[StrengthIntent.Running]) {
      expect(gym).not.toContain(code)
    }
  })

  /** G4 tient telle quelle : le Tronc ne charge pas les jambes. */
  it('donne au Tronc un `lowerBody` faux et aucun exercice de jambes en charge', () => {
    const type = strengthSessionType(StrengthSessionCode.Core)

    expect(type.lowerBody).toBe(false)
    expect(type.minGapAfterRunS).toBe(0)
    for (const id of type.exerciseIds) {
      expect(strengthExercise(id)).toBeDefined()
    }
  })

  it('bâtit le catalogue « pour la course » sur la bibliothèque existante', () => {
    for (const code of STRENGTH_CATALOGUE[StrengthIntent.Running]) {
      const type = strengthSessionType(code)
      for (const id of [...type.exerciseIds, ...type.preventionIds, ...type.plyometricIds]) {
        expect(strengthExercise(id)).toBeDefined()
      }
    }
  })

  it('garde Appuis identique au Legs d’aujourd’hui, dose comprise', () => {
    const context = { phase: StrengthPhase.Force, progressionWeek: 4 }
    const legs = strengthPrescription(StrengthSessionCode.Legs, context)
    const footing = strengthPrescription(StrengthSessionCode.Footing, context)

    expect(footing.steps.map((step) => step.exerciseId)).toEqual(
      legs.steps.map((step) => step.exerciseId),
    )
    expect(footing.durationMin).toBe(legs.durationMin)
    expect(footing.expectedRpe).toBe(legs.expectedRpe)
  })

  it('rend un Rappel d’affûtage sans tractions', () => {
    const recall = strengthPrescription(StrengthSessionCode.Recall, {
      phase: StrengthPhase.Light,
      progressionWeek: 20,
    })

    expect(recall.steps.map((step) => step.exerciseId)).not.toContain('tractions')
    expect(recall.durationMin).toBeGreaterThan(0)
  })
})
