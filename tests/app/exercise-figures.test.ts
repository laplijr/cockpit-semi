import { describe, expect, it } from 'vitest'
import { resolvedPoses } from '~/utils/exercise-figures/draw'
import { FIGURES } from '~/utils/exercise-figures'
import {
  FRAME,
  HEAD_RADIUS,
  SEGMENTS,
  interpolatePose,
  jointsOf,
  type Joints,
} from '~/utils/exercise-figures/skeleton'
import { STRENGTH_EXERCISES } from '~~/server/domain/strength/exercises'

/**
 * Les figures des fiches d'exercice (P25). Un geste mal dessiné est pire que
 * pas de dessin : ces tests ne disent pas qu'une pose est juste — c'est la
 * relecture de Ronan — mais qu'elle est possible.
 */
const lengths = (joints: Joints) =>
  SEGMENTS.map(([from, to]) =>
    Math.hypot(joints[to][0] - joints[from][0], joints[to][1] - joints[from][1]),
  )

describe('figures d’exercice', () => {
  it('dessine chaque exercice de la bibliothèque, et rien d’autre', () => {
    const ids = STRENGTH_EXERCISES.map((exercise) => exercise.id).sort()
    expect(Object.keys(FIGURES).sort()).toEqual(ids)
  })

  /**
   * Relecture de Ronan (24 sept. 2026) : figé, un isométrique ne se
   * comprenait pas. Il montre l'entrée dans la position, puis la tenue ; un
   * gros plan a son propre dessin et pas de poses.
   */
  it('donne au moins deux poses à chaque figure, sauf aux gros plans', () => {
    for (const exercise of STRENGTH_EXERCISES) {
      const figure = FIGURES[exercise.id]!
      if (figure.closeUp) expect(figure.poses, exercise.id).toHaveLength(0)
      else expect(figure.poses.length, exercise.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('garde chaque articulation dans le cadre, au départ, à l’arrivée et entre les deux', () => {
    for (const [id, figure] of Object.entries(FIGURES)) {
      const poses = resolvedPoses(figure)
      const moments = poses
        .slice(1)
        .flatMap((pose, index) =>
          [0, 0.25, 0.5, 0.75, 1].map((t) => interpolatePose(poses[index]!, pose, t)),
        )
      for (const pose of moments) {
        const joints = jointsOf(pose, figure.scale ?? 1)
        for (const [name, [x, y]] of Object.entries(joints)) {
          const margin = name === 'head' ? HEAD_RADIUS * (figure.scale ?? 1) : 0
          expect(x - margin, `${id} ${name} x`).toBeGreaterThanOrEqual(-0.5)
          expect(x + margin, `${id} ${name} x`).toBeLessThanOrEqual(FRAME.width + 0.5)
          expect(y - margin, `${id} ${name} y`).toBeGreaterThanOrEqual(-0.5)
          expect(y + margin, `${id} ${name} y`).toBeLessThanOrEqual(FRAME.height + 0.5)
        }
      }
    }
  })

  it('garde la longueur des segments d’une pose à l’autre, à 10 % près', () => {
    for (const [id, figure] of Object.entries(FIGURES)) {
      const [first, ...others] = resolvedPoses(figure).map((pose) =>
        lengths(jointsOf(pose, figure.scale ?? 1)),
      )
      for (const other of others) {
        first!.forEach((length, index) => {
          expect(
            Math.abs(other[index]! - length) / length,
            `${id} ${SEGMENTS[index]!.join('-')}`,
          ).toBeLessThanOrEqual(0.1)
        })
      }
    }
  })

  it('ancre les poses d’un geste au même endroit du corps', () => {
    for (const [id, figure] of Object.entries(FIGURES)) {
      if (figure.closeUp) continue
      const anchors = figure.poses.map((pose) => (pose.ankle ? 'cheville' : 'hanche'))
      expect(new Set(anchors).size, id).toBe(1)
    }
  })
})
