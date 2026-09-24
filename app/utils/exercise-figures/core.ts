import type { ExerciseFigure } from './skeleton'

/** Les poses du groupe Tronc (P25). */
export const CORE_FIGURES: Record<string, ExerciseFigure> = {
  pallof: {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'hand', to: [4, 64] }],
    poses: [
      { ankle: [58, 151], lean: 0, arm: { to: [72, 66], elbow: 'bas' }, leg: [8, -8, 90] },
      { ankle: [58, 151], lean: 0, arm: { to: [96, 66], elbow: 'bas' }, leg: [8, -8, 90] },
    ],
  },
  'planche-laterale': {
    scale: 0.8,
    props: [{ kind: 'sol' }],
    poses: [{ hip: [66.2, 138.6], lean: 77.6, arm: [0, 90], leg: [-77.6, -77.6, 10] }],
  },
  'dead-bug': {
    scale: 0.75,
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [72, 148], lean: -90, arm: [180, 180], leg: [180, 90, 150] },
      {
        hip: [72, 148],
        lean: -90,
        arm: [-135, -135],
        armFar: [180, 180],
        leg: [180, 90, 150],
        legFar: [135, 135, 180],
      },
    ],
  },
  'pallof-elastique': {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'hand', to: [4, 64] }],
    poses: [
      { ankle: [58, 151], lean: 0, arm: { to: [72, 66], elbow: 'bas' }, leg: [8, -8, 90] },
      { ankle: [58, 151], lean: 0, arm: { to: [96, 66], elbow: 'bas' }, leg: [8, -8, 90] },
    ],
  },
}
