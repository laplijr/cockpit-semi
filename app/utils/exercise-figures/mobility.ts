import type { ExerciseFigure } from './skeleton'

/** Les poses du groupe Mobilité (P25). */
export const MOBILITY_FIGURES: Record<string, ExerciseFigure> = {
  'genou-au-mur': {
    props: [{ kind: 'sol' }, { kind: 'mur', x: 108 }],
    poses: [
      {
        ankle: [86, 151],
        lean: 6,
        arm: { to: [107, 72], elbow: 'bas' },
        leg: [18, 0, 90],
        legFar: [-25, -25, 90],
      },
      {
        ankle: [86, 151],
        lean: 6,
        arm: { to: [107, 80], elbow: 'bas' },
        leg: [40, -30, 90],
        legFar: [-18, -32, 90],
      },
    ],
  },
  'short-foot': {
    props: [{ kind: 'sol' }, { kind: 'banc', x: 10, y: 112, width: 36, height: 42 }],
    poses: [
      { hip: [34, 108], lean: 0, arm: [20, 40], leg: { to: [70, 151], knee: 'haut', foot: 90 } },
    ],
  },
  'etirement-psoas': {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [58, 120],
        lean: -6,
        arm: [180, 180],
        armFar: [0, 0],
        leg: { to: [88, 151], knee: 'avant', foot: 90 },
        legFar: [-23, -90, -90],
      },
    ],
  },
  'mobilite-thoracique': {
    scale: 0.8,
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [40, 120], lean: 80, arm: [40, 150], armFar: [0, 0], leg: [0, -90, -90] },
      { hip: [40, 120], lean: 80, arm: [175, -120], armFar: [0, 0], leg: [0, -90, -90] },
    ],
  },
  respiration: {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [58, 148],
        lean: -90,
        arm: { to: [52, 142], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
}
