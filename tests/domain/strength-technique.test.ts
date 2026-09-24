import { describe, expect, it } from 'vitest'
import { STRENGTH_EXERCISES } from '~~/server/domain/strength/exercises'
import { MUSCLE_LABELS } from '~~/server/domain/strength/muscles'
import { STRENGTH_TECHNIQUE } from '~~/server/domain/strength/technique'

/** Savoir faire l'exercice (P25) : le geste, les erreurs et les muscles. */
describe('fiches techniques', () => {
  it('donne une fiche à chaque exercice de la bibliothèque', () => {
    const missing = STRENGTH_EXERCISES.filter((exercise) => !STRENGTH_TECHNIQUE[exercise.id])
    expect(missing.map((exercise) => exercise.id)).toEqual([])
  })

  it('n’a aucune fiche orpheline', () => {
    const ids = new Set(STRENGTH_EXERCISES.map((exercise) => exercise.id))
    expect(Object.keys(STRENGTH_TECHNIQUE).filter((id) => !ids.has(id))).toEqual([])
  })

  it('porte de trois à cinq consignes, deux erreurs et des muscles nommés', () => {
    for (const [id, sheet] of Object.entries(STRENGTH_TECHNIQUE)) {
      expect(sheet.cues.length, id).toBeGreaterThanOrEqual(3)
      expect(sheet.cues.length, id).toBeLessThanOrEqual(5)
      expect(sheet.mistakes, id).toHaveLength(2)
      expect(sheet.primary.length, id).toBeGreaterThan(0)
      for (const muscle of [...sheet.primary, ...sheet.secondary]) {
        expect(MUSCLE_LABELS[muscle], `${id} ${muscle}`).toBeDefined()
      }
    }
  })
})
