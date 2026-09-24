import { FigureView, type ExerciseFigure } from './skeleton'

/** Les poses du groupe Tirage (P25). */
export const PULL_FIGURES: Record<string, ExerciseFigure> = {
  tractions: {
    scale: 0.85,
    props: [{ kind: 'barre-fixe', at: [60, 14], support: 'haut' }],
    poses: [
      { hip: [60, 92], lean: 0, arm: { to: [60, 14], elbow: 'avant' }, leg: [10, -60, 0] },
      { hip: [58, 62], lean: 4, arm: { to: [60, 14], elbow: 'bas' }, leg: [10, -60, 0] },
    ],
  },
  rowing: {
    scale: 0.85,
    props: [
      { kind: 'sol' },
      { kind: 'banc', x: 22, y: 136, width: 74, height: 18 },
      { kind: 'haltere', at: 'hand' },
    ],
    poses: [
      {
        hip: [46, 104],
        lean: 90,
        arm: [0, 0],
        armFar: { to: [90, 136], elbow: 'arriere' },
        leg: { to: [30, 151], knee: 'avant', foot: 90 },
        legFar: [14, -90, -90],
      },
      {
        hip: [46, 104],
        lean: 90,
        arm: { to: [74, 108], elbow: 'haut' },
        armFar: { to: [90, 136], elbow: 'arriere' },
        leg: { to: [30, 151], knee: 'avant', foot: 90 },
        legFar: [14, -90, -90],
      },
    ],
  },
  'face-pull': {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'hand', to: [118, 34] }],
    poses: [
      { ankle: [44, 151], lean: -4, arm: { to: [92, 36], elbow: 'bas' }, leg: [0, 0, 90] },
      { ankle: [44, 151], lean: -4, arm: { to: [66, 34], elbow: 'haut' }, leg: [0, 0, 90] },
    ],
  },
  'farmer-walk': {
    walking: true,
    props: [{ kind: 'sol' }, { kind: 'haltere', at: 'handFar' }, { kind: 'haltere', at: 'hand' }],
    poses: [
      {
        hip: [60, 82],
        lean: 0,
        arm: [3, 3],
        leg: { to: [74, 151], knee: 'avant', foot: 90 },
        legFar: { to: [46, 151], knee: 'avant', foot: 90 },
      },
      {
        hip: [60, 82],
        lean: 0,
        arm: [3, 3],
        leg: { to: [46, 151], knee: 'avant', foot: 90 },
        legFar: { to: [74, 151], knee: 'avant', foot: 90 },
      },
    ],
  },
  'rowing-elastique': {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'elastique', from: 'hand', to: [118, 66] }],
    poses: [
      { ankle: [44, 151], lean: 4, arm: { to: [90, 68], elbow: 'bas' }, leg: [8, -8, 90] },
      { ankle: [44, 151], lean: 4, arm: { to: [60, 70], elbow: 'arriere' }, leg: [8, -8, 90] },
    ],
  },
  'rowing-australien': {
    scale: 0.75,
    props: [{ kind: 'sol' }, { kind: 'barre-fixe', at: [86, 100], support: 'bas' }],
    poses: [
      {
        hip: [54.2, 141.7],
        lean: 80.1,
        arm: { to: [86, 100], elbow: 'avant' },
        leg: [-80.1, -80.1, 170],
      },
      {
        hip: [49.3, 126.8],
        lean: 63.4,
        arm: { to: [86, 100], elbow: 'bas' },
        leg: [-63.4, -63.4, 150],
      },
    ],
  },
  /** De dessus, à plat ventre, la tête en haut : les bras dessinent Y, puis T, puis W. */
  'ytw-sol': {
    view: FigureView.Above,
    scale: 0.75,
    props: [],
    poses: [
      {
        hip: [60, 96],
        lean: 0,
        arm: [150, 150],
        armFar: [-150, -150],
        leg: [3, 3, 0],
        legFar: [-3, -3, 0],
      },
      {
        hip: [60, 96],
        lean: 0,
        arm: [90, 90],
        armFar: [-90, -90],
        leg: [3, 3, 0],
        legFar: [-3, -3, 0],
      },
      {
        hip: [60, 96],
        lean: 0,
        arm: [55, 150],
        armFar: [-55, -150],
        leg: [3, 3, 0],
        legFar: [-3, -3, 0],
      },
    ],
  },
}
