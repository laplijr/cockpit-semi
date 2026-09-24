import type { ExerciseFigure } from './skeleton'

/** Les poses du groupe Prévention (P25). */
export const PREVENTION_FIGURES: Record<string, ExerciseFigure> = {
  'monster-walk': {
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'ankle', to: 'ankleFar' }],
    poses: [
      { ankle: [74, 151], lean: 20, arm: [20, 60], leg: [40, -10, 90], legFar: [15, -30, 90] },
      { ankle: [64, 151], lean: 20, arm: [20, 60], leg: [25, -25, 90], legFar: [35, -5, 90] },
    ],
  },
  'squat-espagnol': {
    props: [
      { kind: 'sol' },
      { kind: 'mur', x: 6 },
      { kind: 'elastique', from: 'knee', to: [6, 116] },
    ],
    poses: [{ ankle: [72, 151], lean: 10, arm: [80, 80], leg: [78, 0, 90] }],
  },
  'fente-basse': {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [56, 120],
        lean: -4,
        arm: [0, 0],
        leg: { to: [84, 151], knee: 'avant', foot: 90 },
        legFar: [-23, -90, -90],
      },
      {
        hip: [70, 90],
        lean: 0,
        arm: [10, 60],
        leg: { to: [72, 151], knee: 'avant', foot: 90 },
        legFar: [95, 0, 20],
      },
    ],
  },
  copenhagen: {
    scale: 0.7,
    props: [{ kind: 'sol' }, { kind: 'banc', x: 2, y: 128, width: 42, height: 26 }],
    poses: [
      {
        hip: [58.2, 128.4],
        lean: 94.4,
        arm: [0, 90],
        leg: [-94.4, -90, -90],
        legFar: [-60, -60, 30],
      },
    ],
  },
  'fente-laterale': {
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [66, 79], lean: 0, arm: [20, 150], leg: [4, -4, 90], legFar: [-4, 4, -90] },
      {
        hip: [66, 112],
        lean: 14,
        arm: [30, 150],
        leg: { to: [96, 151], knee: 'haut', foot: 90 },
        legFar: { to: [16, 151], knee: 'haut', foot: -90 },
      },
    ],
  },
  'squat-espagnol-sangle': {
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'knee', to: [4, 150] }],
    poses: [{ ankle: [72, 151], lean: 10, arm: [80, 80], leg: [78, 0, 90] }],
  },
  'wall-sit': {
    props: [{ kind: 'sol' }, { kind: 'mur', x: 20 }],
    poses: [{ hip: [28, 116], lean: 0, arm: [10, 10], leg: [90, 0, 90] }],
  },
}
