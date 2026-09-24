import {
  FigureCloseUp,
  FigureView,
  GROUND_Y,
  HEAD_RADIUS,
  interpolatePose,
  jointsOf,
  resolvePose,
  type BodySpread,
  type ExerciseFigure,
  type JointName,
  type Joints,
  type PoseSpec,
  type Prop,
} from './skeleton'

export type ShapeTone = 'corps' | 'loin' | 'charge' | 'decor' | 'meuble'

/**
 * Ce qu'il faut peindre pour une pose, dans l'ordre : le décor, le côté
 * éloigné, le corps, la charge. Le composant et la planche contact lisent la
 * même liste, pour qu'un geste relu soit le geste affiché.
 */
export type FigureItem =
  | { kind: 'line'; from: [number, number]; to: [number, number]; tone: ShapeTone; width: number }
  | { kind: 'circle'; at: [number, number]; r: number; tone: ShapeTone; fill: boolean }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; tone: ShapeTone }
  | { kind: 'path'; d: string; tone: ShapeTone; width?: number }

export interface FigureShape {
  items: FigureItem[]
}

/**
 * Des membres épais plutôt qu'un trait : le bonhomme au fil se lisait mal,
 * de loin comme en vignette (relecture de Ronan, 24 sept. 2026).
 */
const WIDTHS = { torso: 13, neck: 6, upperArm: 7, forearm: 6, thigh: 10, shin: 8, foot: 6 }

const LIMBS: [JointName, JointName, number][] = [
  ['hipNear', 'knee', WIDTHS.thigh],
  ['knee', 'ankle', WIDTHS.shin],
  ['ankle', 'toe', WIDTHS.foot],
  ['shoulderNear', 'elbow', WIDTHS.upperArm],
  ['elbow', 'hand', WIDTHS.forearm],
]

const FAR_LIMBS: [JointName, JointName, number][] = [
  ['hipFar', 'kneeFar', WIDTHS.thigh],
  ['kneeFar', 'ankleFar', WIDTHS.shin],
  ['ankleFar', 'toeFar', WIDTHS.foot],
  ['shoulderFar', 'elbowFar', WIDTHS.upperArm],
  ['elbowFar', 'handFar', WIDTHS.forearm],
]

/** De face et de dessus, les épaules et les hanches ont leur largeur. */
const SPREADS: Record<FigureView, BodySpread | undefined> = {
  [FigureView.Profile]: undefined,
  [FigureView.Front]: { shoulders: 11, hips: 7 },
  [FigureView.Above]: { shoulders: 11, hips: 7 },
}

function decorOf(prop: Prop): FigureItem[] {
  switch (prop.kind) {
    case 'sol':
      return [
        { kind: 'line', from: [0, GROUND_Y + 3], to: [120, GROUND_Y + 3], tone: 'decor', width: 2 },
      ]
    case 'mur':
      return [
        { kind: 'line', from: [prop.x, 0], to: [prop.x, GROUND_Y + 3], tone: 'decor', width: 3 },
      ]
    case 'banc':
      return [
        {
          kind: 'rect',
          x: prop.x,
          y: prop.y,
          width: prop.width,
          height: prop.height,
          tone: 'meuble',
        },
      ]
    case 'marche':
      return [
        {
          kind: 'rect',
          x: prop.x,
          y: prop.y,
          width: prop.width,
          height: GROUND_Y + 3 - prop.y,
          tone: 'meuble',
        },
      ]
    case 'barre-fixe': {
      const end: [number, number] = [prop.at[0], prop.support === 'bas' ? GROUND_Y + 3 : 0]
      return [
        { kind: 'line', from: prop.at, to: end, tone: 'meuble', width: 3 },
        { kind: 'circle', at: prop.at, r: 4, tone: 'decor', fill: true },
      ]
    }
    default:
      return []
  }
}

function loadOf(prop: Prop, joints: Joints): FigureItem[] {
  switch (prop.kind) {
    case 'barre': {
      const at = joints[prop.at]
      const center: [number, number] = [
        at[0] + (prop.offset?.[0] ?? 0),
        at[1] + (prop.offset?.[1] ?? 0),
      ]
      return [
        { kind: 'circle', at: center, r: 10, tone: 'charge', fill: true },
        { kind: 'circle', at: center, r: 2.5, tone: 'decor', fill: true },
      ]
    }
    case 'haltere': {
      const [x, y] = joints[prop.at]
      return [{ kind: 'rect', x: x - 6, y: y - 3.5, width: 12, height: 7, tone: 'charge' }]
    }
    case 'elastique':
      return [
        {
          kind: 'line',
          from: joints[prop.from],
          to: typeof prop.to === 'string' ? joints[prop.to] : prop.to,
          tone: 'charge',
          width: 3,
        },
      ]
    default:
      return []
  }
}

/** Le cou s'arrête au bord de la tête : un trait qui la traverse se lit comme un bâton. */
function neckEnd(joints: Joints, radius: number): [number, number] {
  const [sx, sy] = joints.shoulder
  const [hx, hy] = joints.head
  const length = Math.hypot(hx - sx, hy - sy)
  const keep = Math.max(0, length - radius) / length
  return [sx + (hx - sx) * keep, sy + (hy - sy) * keep]
}

export function shapeOf(figure: ExerciseFigure, pose: PoseSpec): FigureShape {
  const scale = figure.scale ?? 1
  const joints = jointsOf(pose, scale)
  /** De face ou de dessus, les deux côtés se voient autant l'un que l'autre. */
  const farTone: ShapeTone =
    (figure.view ?? FigureView.Profile) === FigureView.Profile ? 'loin' : 'corps'
  const limb = (
    [from, to, width]: [JointName, JointName, number],
    tone: ShapeTone,
  ): FigureItem => ({
    kind: 'line',
    from: joints[from],
    to: joints[to],
    tone,
    width: width * scale,
  })

  /** Hors du profil, le buste est un trapèze plein, des épaules aux hanches. */
  const torso: FigureItem = pose.spread
    ? {
        kind: 'path',
        d: `M ${joints.shoulderNear.join(' ')} L ${joints.shoulderFar.join(' ')} L ${joints.hipFar.join(' ')} L ${joints.hipNear.join(' ')} Z`,
        tone: 'corps',
        width: 6 * scale,
      }
    : {
        kind: 'line',
        from: joints.hip,
        to: joints.shoulder,
        tone: 'corps',
        width: WIDTHS.torso * scale,
      }

  const items: FigureItem[] = [
    ...figure.props.flatMap(decorOf),
    ...FAR_LIMBS.map((segment) => limb(segment, farTone)),
    torso,
    {
      kind: 'line',
      from: joints.shoulder,
      to: neckEnd(joints, HEAD_RADIUS * scale),
      tone: 'corps',
      width: WIDTHS.neck * scale,
    },
    { kind: 'circle', at: joints.head, r: HEAD_RADIUS * scale * 1.15, tone: 'corps', fill: true },
    ...LIMBS.map((segment) => limb(segment, 'corps')),
    ...figure.props.flatMap((prop) => loadOf(prop, joints)),
  ]
  return { items }
}

/**
 * Le gros plan du pied, de profil : la voûte se creuse quand la base du gros
 * orteil se rapproche du talon, les orteils restent à plat. `t` va du pied
 * posé (0) à la voûte active (1).
 */
function footCloseUp(t: number): FigureShape {
  const arch = 118 - (2 + 22 * t)
  const d = [
    'M 50 22',
    'L 58 86',
    'Q 64 98 96 108',
    'Q 106 111 108 117',
    'L 100 119',
    'L 82 119',
    `Q 56 ${arch} 30 119`,
    'Q 18 118 20 106',
    'Q 24 94 34 86',
    'L 30 22 Z',
  ].join(' ')
  return {
    items: [
      { kind: 'line', from: [0, 121], to: [120, 121], tone: 'decor', width: 2 },
      { kind: 'path', d, tone: 'corps' },
      { kind: 'line', from: [56, arch + 6], to: [56, 119], tone: 'charge', width: 2 },
    ],
  }
}

/**
 * Le Pallof vu de dessus, face vers le bas de l'écran : les mains partent du
 * sternum et s'éloignent droit devant, l'élastique tire de côté depuis le
 * poteau, et les épaules ne tournent pas. `t` va des mains au sternum (0) aux
 * bras tendus (1).
 */
function pallofFromAbove(t: number): FigureShape {
  const hand: [number, number] = [64, 90 + 30 * t]
  const flare = 13 * (1 - t) + 2
  const near: [number, number] = [80, 74]
  const far: [number, number] = [48, 74]
  const elbowNear: [number, number] = [(near[0] + hand[0]) / 2 + flare, (near[1] + hand[1]) / 2]
  const elbowFar: [number, number] = [(far[0] + hand[0]) / 2 - flare, (far[1] + hand[1]) / 2]
  return {
    items: [
      { kind: 'line', from: [10, 40], to: [10, 150], tone: 'meuble', width: 4 },
      { kind: 'circle', at: [10, 96], r: 4, tone: 'decor', fill: true },
      { kind: 'line', from: [57, 70], to: [57, 88], tone: 'loin', width: 8 },
      { kind: 'line', from: [71, 70], to: [71, 88], tone: 'loin', width: 8 },
      { kind: 'line', from: far, to: near, tone: 'corps', width: 14 },
      { kind: 'circle', at: [64, 75], r: 8, tone: 'loin', fill: true },
      { kind: 'line', from: [64, 80], to: [64, 85], tone: 'loin', width: 3 },
      { kind: 'line', from: near, to: elbowNear, tone: 'corps', width: 7 },
      { kind: 'line', from: elbowNear, to: hand, tone: 'corps', width: 6 },
      { kind: 'line', from: far, to: elbowFar, tone: 'corps', width: 7 },
      { kind: 'line', from: elbowFar, to: hand, tone: 'corps', width: 6 },
      { kind: 'line', from: [10, 96], to: hand, tone: 'charge', width: 3 },
    ],
  }
}

/** Les poses d'une figure, résolues en angles une fois pour toutes. */
export function resolvedPoses(figure: ExerciseFigure): PoseSpec[] {
  const spread = SPREADS[figure.view ?? FigureView.Profile]
  return figure.poses.map((pose) => resolvePose(pose, figure.scale ?? 1, spread))
}

/**
 * La forme à l'instant `t` du geste : 0 à la première pose, 1 à la deuxième,
 * 2 à la troisième quand il y en a une.
 */
export function shapeAt(figure: ExerciseFigure, poses: PoseSpec[], t: number): FigureShape {
  const clamped = Math.min(1, Math.max(0, t))
  if (figure.closeUp === FigureCloseUp.Foot) return footCloseUp(clamped)
  if (figure.closeUp === FigureCloseUp.PallofFromAbove) return pallofFromAbove(clamped)
  if (poses.length === 1) return shapeOf(figure, poses[0]!)
  const segment = Math.min(poses.length - 2, Math.max(0, Math.floor(t)))
  return shapeOf(figure, interpolatePose(poses[segment]!, poses[segment + 1]!, t - segment))
}
