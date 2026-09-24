import { FigureCloseUp, type ExerciseFigure } from './skeleton'

/** Les poses du groupe Mobilité (P25). Un isométrique entre dans la position, puis la tient. */
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
  /** En gros plan : la voûte se creuse, les orteils restent à plat. */
  'short-foot': { closeUp: FigureCloseUp.Foot, props: [], poses: [] },
  /** Du genou au sol, la fesse serrée avance le bassin, le bras monte. */
  'etirement-psoas': {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [52, 120],
        lean: 0,
        arm: [10, 10],
        leg: { to: [86, 151], knee: 'avant', foot: 90 },
        legFar: [-18, -90, -90],
      },
      {
        hip: [60, 124],
        lean: -8,
        arm: [180, 180],
        leg: { to: [86, 151], knee: 'avant', foot: 90 },
        legFar: [-35, -90, -90],
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
  /** La main sur le ventre monte à l'inspiration : c'est le ventre qui respire. */
  respiration: {
    scale: 0.85,
    props: [{ kind: 'sol' }],
    poses: [
      {
        hip: [58, 148],
        lean: -90,
        arm: { to: [50, 144], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
      {
        hip: [58, 148],
        lean: -90,
        arm: { to: [50, 137], elbow: 'haut' },
        leg: { to: [86, 151], knee: 'haut', foot: 90 },
      },
    ],
  },
}
