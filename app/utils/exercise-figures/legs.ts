import type { ExerciseFigure } from './skeleton'

/** Les poses du groupe Jambes (P25) : départ, puis l'autre bout du geste. */
export const LEGS_FIGURES: Record<string, ExerciseFigure> = {
  squat: {
    props: [{ kind: 'sol' }, { kind: 'barre', at: 'shoulder', offset: [-5, 3] }],
    poses: [
      { ankle: [56, 151], lean: 8, arm: [-40, 165], leg: [2, -2, 90] },
      { ankle: [56, 151], lean: 42, arm: [-5, 150], leg: [97, -38, 90] },
    ],
  },
  'goblet-squat': {
    props: [{ kind: 'sol' }, { kind: 'haltere', at: 'hand' }],
    poses: [
      { ankle: [56, 151], lean: 2, arm: [15, 170], leg: [2, -2, 90] },
      { ankle: [56, 151], lean: 22, arm: [45, 170], leg: [100, -40, 90] },
    ],
  },
  'sdt-roumain': {
    props: [{ kind: 'sol' }, { kind: 'barre', at: 'hand' }],
    poses: [
      { ankle: [60, 151], lean: 0, arm: [0, 0], leg: [4, -4, 90] },
      { ankle: [60, 151], lean: 72, arm: [8, 4], leg: [20, -10, 90] },
    ],
  },
  'fente-bulgare': {
    props: [{ kind: 'sol' }, { kind: 'banc', x: 4, y: 118, width: 30, height: 36 }],
    poses: [
      {
        hip: [58, 86],
        lean: 6,
        arm: [0, 0],
        leg: { to: [82, 151], knee: 'avant', foot: 90 },
        legFar: { to: [28, 112], knee: 'bas', foot: -95 },
      },
      {
        hip: [54, 108],
        lean: 14,
        arm: [8, 4],
        leg: { to: [82, 151], knee: 'avant', foot: 90 },
        legFar: { to: [28, 112], knee: 'bas', foot: -95 },
      },
    ],
  },
  'mollet-unipodal': {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'marche', x: 46, y: 140, width: 26 }, { kind: 'mur', x: 104 }],
    poses: [
      {
        ankle: [61, 134],
        lean: 2,
        arm: { to: [103, 70], elbow: 'bas' },
        leg: [0, 0, 55],
        legFar: [-8, -95, -170],
      },
      {
        ankle: [60, 146],
        lean: 2,
        arm: { to: [103, 80], elbow: 'bas' },
        leg: [0, 0, 120],
        legFar: [-8, -95, -170],
      },
    ],
  },
  'mollet-soleaire': {
    scale: 0.9,
    props: [{ kind: 'sol' }, { kind: 'marche', x: 46, y: 140, width: 26 }, { kind: 'mur', x: 104 }],
    poses: [
      {
        ankle: [61, 134],
        lean: 6,
        arm: { to: [103, 82], elbow: 'bas' },
        leg: [30, -14, 55],
        legFar: [-8, -95, -170],
      },
      {
        ankle: [60, 146],
        lean: 6,
        arm: { to: [103, 92], elbow: 'bas' },
        leg: [30, -14, 120],
        legFar: [-8, -95, -170],
      },
    ],
  },
  nordic: {
    scale: 0.8,
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [40, 120.4], lean: 0, arm: [40, 160], leg: [0, -90, -90] },
      { hip: [62.7, 131], lean: 50, arm: [40, 160], leg: [-50, -90, -90] },
    ],
  },
  pliometrie: {
    props: [{ kind: 'sol' }],
    poses: [
      { ankle: [58, 151], lean: 10, arm: [-30, -15], leg: [15, -15, 80] },
      { ankle: [58, 140], lean: 0, arm: [100, 120], leg: [0, 0, 40] },
    ],
  },
  'saut-unipodal': {
    props: [{ kind: 'sol' }],
    poses: [
      { ankle: [58, 151], lean: 10, arm: [-30, -15], leg: [15, -15, 80], legFar: [60, 0, 90] },
      { ankle: [58, 140], lean: 0, arm: [100, 120], leg: [0, 0, 40], legFar: [45, -25, 60] },
    ],
  },
  'hip-thrust': {
    scale: 0.85,
    props: [
      { kind: 'sol' },
      { kind: 'banc', x: 2, y: 116, width: 26, height: 38 },
      { kind: 'barre', at: 'hip', offset: [3, -7] },
    ],
    poses: [
      {
        hip: [52, 136],
        lean: -43,
        head: -10,
        arm: { to: [56, 128], elbow: 'bas' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
      {
        hip: [60, 110],
        lean: -90,
        head: -60,
        arm: { to: [64, 102], elbow: 'bas' },
        leg: { to: [88, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
  'pont-fessier': {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [58, 148], lean: -90, arm: [90, 90], leg: { to: [86, 151], knee: 'haut', foot: 90 } },
      {
        hip: [52, 128],
        lean: -121,
        arm: { to: [48, 150], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
  'mollet-bipodal': {
    props: [{ kind: 'sol' }],
    poses: [
      { ankle: [59, 151], lean: 0, arm: [0, 0], leg: [0, 0, 90] },
      { ankle: [61.6, 143.9], lean: 0, arm: [0, 0], leg: [0, 0, 50] },
    ],
  },
  'sdt-halteres': {
    props: [{ kind: 'sol' }, { kind: 'haltere', at: 'hand' }],
    poses: [
      { ankle: [60, 151], lean: 0, arm: [0, 0], leg: [4, -4, 90] },
      { ankle: [60, 151], lean: 72, arm: [8, 4], leg: [20, -10, 90] },
    ],
  },
  'sdt-unipodal': {
    scale: 0.75,
    props: [{ kind: 'sol' }],
    poses: [
      { ankle: [64, 151], lean: 0, arm: [0, 0], leg: [5, -5, 90], legFar: [-10, -40, 90] },
      { ankle: [64, 151], lean: 76, arm: [10, 5], leg: [12, -8, 90], legFar: [-92, -92, 0] },
    ],
  },
  'pont-fessier-leste': {
    scale: 0.85,
    props: [{ kind: 'sol' }, { kind: 'haltere', at: 'hip' }],
    poses: [
      {
        hip: [58, 148],
        lean: -90,
        arm: { to: [58, 144], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
      {
        hip: [52, 128],
        lean: -121,
        arm: { to: [52, 124], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
  'pont-fessier-unipodal': {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [58, 148],
        lean: -90,
        arm: [90, 90],
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
        legFar: [115, 115, 150],
      },
      {
        hip: [52, 128],
        lean: -121,
        arm: { to: [48, 150], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
        legFar: [100, 100, 150],
      },
    ],
  },
}
