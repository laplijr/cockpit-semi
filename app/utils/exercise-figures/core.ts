import { FigureCloseUp, FigureView, type ExerciseFigure } from './skeleton'

/** Les poses du groupe Tronc (P25). */
export const CORE_FIGURES: Record<string, ExerciseFigure> = {
  /** Vu de dessus : l'élastique tire de côté, les mains partent droit devant. */
  pallof: { closeUp: FigureCloseUp.PallofFromAbove, props: [], poses: [] },
  /**
   * De face, le coude sous l'épaule et le bras du dessus tendu vers le haut :
   * les hanches montent du sol jusqu'à l'alignement, puis tiennent.
   */
  'planche-laterale': {
    view: FigureView.Front,
    scale: 0.72,
    props: [{ kind: 'sol' }],
    poses: [
      { hip: [56, 146], lean: 86, arm: [180, 180], armFar: [0, 90], leg: [-86, -86, 180] },
      { hip: [58, 134], lean: 76, arm: [180, 180], armFar: [0, 90], leg: [-76, -76, 180] },
    ],
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
  'pallof-elastique': { closeUp: FigureCloseUp.PallofFromAbove, props: [], poses: [] },
}
