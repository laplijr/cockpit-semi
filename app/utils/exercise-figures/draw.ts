import {
  GROUND_Y,
  HEAD_RADIUS,
  interpolatePose,
  jointsOf,
  resolvePose,
  type ExerciseFigure,
  type Joints,
  type PoseSpec,
  type Prop,
} from './skeleton'

/**
 * Ce qu'il faut tracer pour une pose : des segments et des formes, en
 * coordonnées du cadre. Le composant et la planche contact lisent la même
 * chose, pour qu'un geste relu soit le geste affiché.
 */
export interface FigureShape {
  lines: {
    from: [number, number]
    to: [number, number]
    tone: 'corps' | 'loin' | 'charge' | 'decor'
  }[]
  circles: { at: [number, number]; r: number; tone: 'corps' | 'charge' | 'decor'; fill?: boolean }[]
  rects: { x: number; y: number; width: number; height: number }[]
}

const LIMBS: [keyof Joints, keyof Joints][] = [
  ['shoulder', 'elbow'],
  ['elbow', 'hand'],
  ['hip', 'knee'],
  ['knee', 'ankle'],
  ['ankle', 'toe'],
]

const FAR_LIMBS: [keyof Joints, keyof Joints][] = [
  ['shoulder', 'elbowFar'],
  ['elbowFar', 'handFar'],
  ['hip', 'kneeFar'],
  ['kneeFar', 'ankleFar'],
  ['ankleFar', 'toeFar'],
]

function propShape(prop: Prop, joints: Joints, shape: FigureShape) {
  switch (prop.kind) {
    case 'barre': {
      const at = joints[prop.at]
      const center: [number, number] = [
        at[0] + (prop.offset?.[0] ?? 0),
        at[1] + (prop.offset?.[1] ?? 0),
      ]
      shape.circles.push(
        { at: center, r: 9, tone: 'charge' },
        { at: center, r: 2, tone: 'charge', fill: true },
      )
      return
    }
    case 'haltere':
      shape.circles.push({ at: joints[prop.at], r: 4.5, tone: 'charge', fill: true })
      return
    case 'elastique':
      shape.lines.push({
        from: joints[prop.from],
        to: typeof prop.to === 'string' ? joints[prop.to] : prop.to,
        tone: 'charge',
      })
      return
    case 'banc':
    case 'marche': {
      const height = prop.kind === 'banc' ? prop.height : GROUND_Y - prop.y
      shape.rects.push({ x: prop.x, y: prop.y, width: prop.width, height })
      return
    }
    case 'mur':
      shape.lines.push({ from: [prop.x, 0], to: [prop.x, GROUND_Y], tone: 'decor' })
      return
    case 'barre-fixe':
      shape.circles.push({ at: prop.at, r: 2.5, tone: 'decor', fill: true })
      return
    case 'sol':
      shape.lines.push({ from: [0, GROUND_Y], to: [120, GROUND_Y], tone: 'decor' })
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
  const shape: FigureShape = { lines: [], circles: [], rects: [] }

  for (const prop of figure.props) propShape(prop, joints, shape)
  for (const [from, to] of FAR_LIMBS)
    shape.lines.push({ from: joints[from], to: joints[to], tone: 'loin' })
  shape.lines.push({ from: joints.hip, to: joints.shoulder, tone: 'corps' })
  shape.lines.push({
    from: joints.shoulder,
    to: neckEnd(joints, HEAD_RADIUS * scale),
    tone: 'corps',
  })
  for (const [from, to] of LIMBS)
    shape.lines.push({ from: joints[from], to: joints[to], tone: 'corps' })
  shape.circles.push({ at: joints.head, r: HEAD_RADIUS * scale, tone: 'corps' })
  // La charge passe devant le corps : une barre derrière la nuque se lit mieux dessus.
  shape.lines.sort((a, b) => Number(a.tone === 'charge') - Number(b.tone === 'charge'))
  return shape
}

/** Les poses d'une figure, résolues en angles une fois pour toutes. */
export function resolvedPoses(figure: ExerciseFigure): PoseSpec[] {
  return figure.poses.map((pose) => resolvePose(pose, figure.scale ?? 1))
}

/** La forme à l'instant `t` du geste, de la première pose (0) à la seconde (1). */
export function shapeAt(figure: ExerciseFigure, poses: PoseSpec[], t: number): FigureShape {
  if (poses.length === 1) return shapeOf(figure, poses[0]!)
  return shapeOf(figure, interpolatePose(poses[0]!, poses[1]!, t))
}
