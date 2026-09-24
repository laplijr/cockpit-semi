import type { ExerciseFigure } from './skeleton'

/** Les poses du groupe Poussée (P25). */
export const PUSH_FIGURES: Record<string, ExerciseFigure> = {
  'developpe-couche': {
    scale: 0.8,
    props: [
      { kind: 'sol' },
      { kind: 'banc', x: 10, y: 118, width: 62, height: 36 },
      { kind: 'barre', at: 'hand' },
    ],
    poses: [
      {
        hip: [58, 114],
        lean: -90,
        arm: { to: [25, 77], elbow: 'avant' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
      {
        hip: [58, 114],
        lean: -90,
        arm: { to: [30, 104], elbow: 'bas' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
  'developpe-militaire': {
    scale: 0.8,
    props: [{ kind: 'sol' }, { kind: 'haltere', at: 'hand' }],
    poses: [
      { ankle: [60, 151], lean: 0, arm: { to: [64, 56], elbow: 'bas' }, leg: [0, 0, 90] },
      { ankle: [60, 151], lean: 0, arm: { to: [62, 21], elbow: 'avant' }, leg: [0, 0, 90] },
    ],
  },
  dips: {
    scale: 0.85,
    props: [{ kind: 'barre-fixe', at: [62, 90], support: 'bas' }],
    poses: [
      { hip: [57, 87], lean: 5, arm: { to: [62, 90], elbow: 'arriere' }, leg: [10, -60, -30] },
      { hip: [55, 104], lean: 20, arm: { to: [62, 90], elbow: 'arriere' }, leg: [10, -60, -30] },
    ],
  },
  'developpe-halteres': {
    scale: 0.8,
    props: [
      { kind: 'sol' },
      { kind: 'banc', x: 10, y: 118, width: 62, height: 36 },
      { kind: 'haltere', at: 'hand' },
    ],
    poses: [
      {
        hip: [58, 114],
        lean: -90,
        arm: { to: [25, 77], elbow: 'avant' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
      {
        hip: [58, 114],
        lean: -90,
        arm: { to: [28, 102], elbow: 'bas' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
  pompes: {
    scale: 0.75,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [61.2, 128.7],
        lean: 65.6,
        arm: { to: [90, 151], elbow: 'arriere' },
        leg: [-65.6, -65.6, 10],
      },
      {
        hip: [65.5, 143.6],
        lean: 82.1,
        arm: { to: [90, 151], elbow: 'arriere' },
        leg: [-82.1, -82.1, 10],
      },
    ],
  },
}
