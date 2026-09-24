import { FigureView, type ExerciseFigure } from './skeleton'

/** Les poses du groupe Prévention (P25). Un isométrique entre dans la position, puis la tient. */
export const PREVENTION_FIGURES: Record<string, ExerciseFigure> = {
  /** De face : l'élastique aux chevilles se tend quand le pas s'ouvre. */
  'monster-walk': {
    view: FigureView.Front,
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'ankle', to: 'ankleFar' }],
    poses: [
      {
        hip: [60, 96],
        lean: 0,
        arm: [20, 5],
        armFar: [-20, -5],
        leg: { to: [70, 151], knee: 'avant', foot: 90 },
        legFar: { to: [50, 151], knee: 'arriere', foot: -90 },
      },
      {
        hip: [68, 96],
        lean: 0,
        arm: [20, 5],
        armFar: [-20, -5],
        leg: { to: [92, 151], knee: 'avant', foot: 90 },
        legFar: { to: [52, 151], knee: 'arriere', foot: -90 },
      },
    ],
  },
  'squat-espagnol': {
    props: [
      { kind: 'sol' },
      { kind: 'mur', x: 6 },
      { kind: 'elastique', from: 'knee', to: [6, 116] },
    ],
    poses: [
      { ankle: [72, 151], lean: 4, arm: [55, 55], leg: [3, -3, 90] },
      { ankle: [72, 151], lean: 10, arm: [80, 80], leg: [78, 0, 90] },
    ],
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
  /** Comme la planche latérale, de face, le genou du dessus posé sur le banc. */
  copenhagen: {
    view: FigureView.Front,
    scale: 0.7,
    props: [{ kind: 'sol' }, { kind: 'banc', x: 2, y: 124, width: 34, height: 30 }],
    poses: [
      {
        hip: [58, 146],
        lean: 90,
        arm: { to: [62, 140], elbow: 'haut' },
        armFar: [0, 90],
        leg: [-86, -90, 180],
        legFar: { to: [34, 151], knee: 'haut', foot: 180 },
      },
      {
        hip: [58, 132],
        lean: 84,
        arm: { to: [62, 126], elbow: 'haut' },
        armFar: [0, 90],
        leg: [-96, -90, 180],
        legFar: { to: [38, 151], knee: 'haut', foot: 180 },
      },
    ],
  },
  /** De face : le pas de côté, le genou fléchi au-dessus du pied, l'autre jambe tendue. */
  'fente-laterale': {
    view: FigureView.Front,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [60, 80],
        lean: 0,
        arm: { to: [63, 58], elbow: 'avant' },
        armFar: { to: [57, 58], elbow: 'arriere' },
        leg: { to: [68, 151], knee: 'avant', foot: 90 },
        legFar: { to: [52, 151], knee: 'arriere', foot: -90 },
      },
      {
        hip: [72, 104],
        lean: 8,
        arm: { to: [75, 80], elbow: 'avant' },
        armFar: { to: [69, 80], elbow: 'arriere' },
        leg: { to: [94, 151], knee: 'avant', foot: 90 },
        legFar: { to: [16, 151], knee: 'haut', foot: -90 },
      },
    ],
  },
  'squat-espagnol-sangle': {
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'knee', to: [4, 150] }],
    poses: [
      { ankle: [72, 151], lean: 4, arm: [55, 55], leg: [3, -3, 90] },
      { ankle: [72, 151], lean: 10, arm: [80, 80], leg: [78, 0, 90] },
    ],
  },
  'wall-sit': {
    props: [{ kind: 'sol' }, { kind: 'mur', x: 20 }],
    poses: [
      { hip: [30, 82], lean: 0, arm: [10, 10], leg: { to: [60, 151], knee: 'avant', foot: 90 } },
      { hip: [28, 116], lean: 0, arm: [10, 10], leg: [90, 0, 90] },
    ],
  },
}
