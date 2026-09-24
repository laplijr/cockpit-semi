/**
 * Le bonhomme des fiches d'exercice (P25) : de profil, tourné vers la droite,
 * dans un cadre de 120 × 160. Une pose se décrit par l'angle de chaque
 * segment, pas par des coordonnées : les longueurs restent celles du corps
 * d'une pose à l'autre, et l'interpolation se fait sur les angles — un tibia
 * ne s'allonge pas à mi-chemin.
 *
 * Un angle se mesure depuis la verticale descendante, positif vers l'avant :
 * 0 pend vers le sol, 90 pointe devant, 180 monte, −90 pointe derrière. Le
 * buste se dit par son inclinaison : 0 debout, positif penché en avant.
 */

export const FRAME = { width: 120, height: 160 } as const
export const GROUND_Y = 154

const LENGTHS = {
  torso: 44,
  neck: 15,
  headRadius: 7,
  upperArm: 25,
  forearm: 23,
  thigh: 37,
  shin: 35,
  foot: 11,
} as const

export type Point = [number, number]

/** Bras : haut du bras puis avant-bras. */
export type ArmAngles = [number, number]
/** Jambe : cuisse, tibia, pied. */
export type LegAngles = [number, number, number]

/** Le côté où plie l'articulation du milieu quand on vise un point. */
export type Bend = 'avant' | 'arriere' | 'haut' | 'bas'

/**
 * Un membre s'écrit par ses angles, ou par le point que vise son extrémité :
 * le coude ou le genou se déduit, du côté demandé. C'est plus sûr à écrire
 * — « le pied sur le banc » — et ça se résout en angles avant tout calcul.
 */
export type ArmInput = ArmAngles | { to: Point; elbow: Bend }
export type LegInput = LegAngles | { to: Point; knee: Bend; foot: number }

export interface PoseInput {
  /** Où tient la pose : la hanche, ou la cheville proche quand les pieds sont au sol. */
  hip?: Point
  ankle?: Point
  lean: number
  /** Inclinaison de la tête ; sans valeur, celle du buste. */
  head?: number
  arm: ArmInput
  /** Le bras du côté éloigné, quand il ne fait pas comme l'autre. */
  armFar?: ArmInput
  leg: LegInput
  legFar?: LegInput
}

/**
 * La demi-largeur des épaules et des hanches. Nulle de profil, où les deux
 * côtés se superposent ; de face et de dessus, les bras partent de deux
 * épaules et les jambes de deux hanches.
 */
export interface BodySpread {
  shoulders: number
  hips: number
}

/** Une pose résolue : rien que des angles, et une ancre. */
export interface PoseSpec {
  hip?: Point
  ankle?: Point
  spread?: BodySpread
  lean: number
  head?: number
  arm: ArmAngles
  armFar?: ArmAngles
  leg: LegAngles
  legFar?: LegAngles
}

export interface Joints {
  head: Point
  /** Le milieu des épaules et celui des hanches : la ligne du buste. */
  shoulder: Point
  shoulderNear: Point
  shoulderFar: Point
  elbow: Point
  hand: Point
  elbowFar: Point
  handFar: Point
  hip: Point
  hipNear: Point
  hipFar: Point
  knee: Point
  ankle: Point
  toe: Point
  kneeFar: Point
  ankleFar: Point
  toeFar: Point
}

export type JointName = keyof Joints

/** Les segments du corps : ce sont leurs longueurs qu'une pose juste conserve. */
export const SEGMENTS: [JointName, JointName][] = [
  ['hip', 'shoulder'],
  ['shoulder', 'head'],
  ['shoulderNear', 'elbow'],
  ['elbow', 'hand'],
  ['shoulderFar', 'elbowFar'],
  ['elbowFar', 'handFar'],
  ['hipNear', 'knee'],
  ['knee', 'ankle'],
  ['ankle', 'toe'],
  ['hipFar', 'kneeFar'],
  ['kneeFar', 'ankleFar'],
  ['ankleFar', 'toeFar'],
]

const RAD = Math.PI / 180

function step(from: Point, angle: number, length: number): Point {
  return [from[0] + Math.sin(angle * RAD) * length, from[1] + Math.cos(angle * RAD) * length]
}

function angleTo(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[1] - from[1]) / RAD
}

const BEND_DIRECTIONS: Record<Bend, Point> = {
  avant: [1, 0],
  arriere: [-1, 0],
  haut: [0, -1],
  bas: [0, 1],
}

/**
 * Deux segments de longueurs `upper` et `lower` qui vont de `root` vers
 * `target`, pliés du côté `bend`. Hors de portée, le membre s'allonge vers
 * la cible sans l'atteindre : les longueurs gagnent toujours.
 */
function reach(root: Point, target: Point, upper: number, lower: number, bend: Bend) {
  const distance = Math.min(
    upper + lower - 0.01,
    Math.max(Math.abs(upper - lower) + 0.01, Math.hypot(target[0] - root[0], target[1] - root[1])),
  )
  const toward = angleTo(root, target)
  const inner = Math.acos((upper ** 2 + distance ** 2 - lower ** 2) / (2 * upper * distance)) / RAD
  const direction = BEND_DIRECTIONS[bend]
  const [first] = [toward + inner, toward - inner]
    .map((angle) => ({ angle, joint: step(root, angle, upper) }))
    .sort(
      (a, b) =>
        (b.joint[0] - root[0]) * direction[0] +
        (b.joint[1] - root[1]) * direction[1] -
        ((a.joint[0] - root[0]) * direction[0] + (a.joint[1] - root[1]) * direction[1]),
    )
  const end = step(root, toward, distance)
  return [first!.angle, angleTo(first!.joint, end)] as const
}

/** Vers le côté proche, perpendiculaire au buste. */
function sideOf(lean: number): Point {
  const torso = (180 - lean) * RAD
  return [-Math.cos(torso), Math.sin(torso)]
}

const offset = (point: Point, side: Point, amount: number): Point => [
  point[0] + side[0] * amount,
  point[1] + side[1] * amount,
]

/** Le milieu des hanches : donné, ou déduit de la cheville proche. */
function hipOf(pose: PoseSpec, scale: number): Point {
  if (pose.hip) return pose.hip
  const ankle = pose.ankle!
  const [thigh, shin] = pose.leg
  const knee = step(ankle, shin + 180, LENGTHS.shin * scale)
  const near = step(knee, thigh + 180, LENGTHS.thigh * scale)
  return offset(near, sideOf(pose.lean), -(pose.spread?.hips ?? 0) * scale)
}

/** Le buste d'une pose : les milieux et les racines des membres. */
function frameOf(pose: PoseSpec, scale: number) {
  const hip = hipOf(pose, scale)
  const shoulder = step(hip, 180 - pose.lean, LENGTHS.torso * scale)
  const side = sideOf(pose.lean)
  const shoulders = (pose.spread?.shoulders ?? 0) * scale
  const hips = (pose.spread?.hips ?? 0) * scale
  return {
    hip,
    shoulder,
    hipNear: offset(hip, side, hips),
    hipFar: offset(hip, side, -hips),
    shoulderNear: offset(shoulder, side, shoulders),
    shoulderFar: offset(shoulder, side, -shoulders),
  }
}

/**
 * Les angles d'une pose écrite par points. L'ancre à la cheville suppose la
 * jambe proche en angles : c'est d'elle que se déduit la hanche.
 */
export function resolvePose(input: PoseInput, scale = 1, spread?: BodySpread): PoseSpec {
  const leg = (limb: LegInput, hip: Point): LegAngles =>
    Array.isArray(limb)
      ? limb
      : [...reach(hip, limb.to, LENGTHS.thigh * scale, LENGTHS.shin * scale, limb.knee), limb.foot]

  const nearLeg = input.leg
  if (!Array.isArray(nearLeg) && !input.hip) {
    throw new Error('Une jambe écrite par son point demande une hanche.')
  }
  const draft: PoseSpec = {
    hip: input.hip,
    ankle: input.ankle,
    spread,
    lean: input.lean,
    head: input.head,
    arm: [0, 0],
    leg: Array.isArray(nearLeg) ? nearLeg : [0, 0, 90],
  }
  const body = frameOf(draft, scale)
  const arm = (limb: ArmInput, root: Point): ArmAngles =>
    Array.isArray(limb)
      ? limb
      : [...reach(root, limb.to, LENGTHS.upperArm * scale, LENGTHS.forearm * scale, limb.elbow)]

  return {
    ...draft,
    arm: arm(input.arm, body.shoulderNear),
    armFar: input.armFar ? arm(input.armFar, body.shoulderFar) : undefined,
    leg: leg(input.leg, body.hipNear),
    legFar: input.legFar ? leg(input.legFar, body.hipFar) : undefined,
  }
}

/** Les articulations d'une pose, à l'échelle de la figure. */
export function jointsOf(pose: PoseSpec, scale = 1): Joints {
  const body = frameOf(pose, scale)
  const head = step(body.shoulder, 180 - (pose.head ?? pose.lean), LENGTHS.neck * scale)

  const arm = (angles: ArmAngles, root: Point) => {
    const elbow = step(root, angles[0], LENGTHS.upperArm * scale)
    return [elbow, step(elbow, angles[1], LENGTHS.forearm * scale)] as const
  }
  const leg = (angles: LegAngles, root: Point) => {
    const knee = step(root, angles[0], LENGTHS.thigh * scale)
    const ankle = step(knee, angles[1], LENGTHS.shin * scale)
    return [knee, ankle, step(ankle, angles[2], LENGTHS.foot * scale)] as const
  }

  const [elbow, hand] = arm(pose.arm, body.shoulderNear)
  const [elbowFar, handFar] = arm(pose.armFar ?? pose.arm, body.shoulderFar)
  const [knee, ankle, toe] = leg(pose.leg, body.hipNear)
  const [kneeFar, ankleFar, toeFar] = leg(pose.legFar ?? pose.leg, body.hipFar)

  return {
    head,
    ...body,
    elbow,
    hand,
    elbowFar,
    handFar,
    knee,
    ankle,
    toe,
    kneeFar,
    ankleFar,
    toeFar,
  }
}

export const HEAD_RADIUS = LENGTHS.headRadius

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixList = <T extends number[]>(a: T, b: T, t: number) =>
  a.map((value, index) => mix(value, b[index]!, t)) as T

/** Un angle tourne par le plus court : de 170 à −170, c'est 20 degrés, pas 340. */
const mixAngle = (a: number, b: number, t: number) =>
  a + (((((b - a) % 360) + 540) % 360) - 180) * t
const mixAngles = <T extends number[]>(a: T, b: T, t: number) =>
  a.map((value, index) => mixAngle(value, b[index]!, t)) as T

/** La pose à mi-chemin, sur les angles : les longueurs ne bougent pas. */
export function interpolatePose(a: PoseSpec, b: PoseSpec, t: number): PoseSpec {
  const anchor = a.ankle && b.ankle ? { ankle: mixList(a.ankle, b.ankle, t) } : {}
  const hip = a.hip && b.hip ? { hip: mixList(a.hip, b.hip, t) } : {}
  return {
    ...anchor,
    ...hip,
    spread: a.spread,
    lean: mix(a.lean, b.lean, t),
    head: mix(a.head ?? a.lean, b.head ?? b.lean, t),
    arm: mixAngles(a.arm, b.arm, t),
    armFar: mixAngles(a.armFar ?? a.arm, b.armFar ?? b.arm, t),
    leg: mixAngles(a.leg, b.leg, t),
    legFar: mixAngles(a.legFar ?? a.leg, b.legFar ?? b.leg, t),
  }
}

/** Ce qui entoure le corps : la charge en accent, le décor en filet. */
export type Prop =
  | { kind: 'barre'; at: JointName; offset?: Point }
  | { kind: 'haltere'; at: JointName }
  | { kind: 'elastique'; from: JointName; to: Point | JointName }
  | { kind: 'banc'; x: number; y: number; width: number; height: number }
  | { kind: 'marche'; x: number; y: number; width: number }
  | { kind: 'mur'; x: number }
  /** Une barre vue en bout : son montant descend au sol ou monte au plafond. */
  | { kind: 'barre-fixe'; at: Point; support?: 'haut' | 'bas' }
  | { kind: 'sol' }

/**
 * D'où l'on regarde le geste (relecture de Ronan, 24 sept. 2026) : le profil
 * ne montre ni une fente latérale, ni un Pallof, ni un Y-T-W. De face, x est
 * le côté ; de dessus, x est le côté et y va de la tête aux pieds. Hors du
 * profil, les deux côtés du corps se voient autant l'un que l'autre.
 */
export enum FigureView {
  Profile = 'profil',
  Front = 'face',
  Above = 'dessus',
}

/**
 * Un dessin à part quand le corps entier ne montre rien : la voûte du pied,
 * ou un Pallof vu de dessus — de profil comme de face, l'élastique qui tire
 * de côté ne se voit pas, et le geste se lit comme un développé.
 */
export enum FigureCloseUp {
  Foot = 'pied',
  PallofFromAbove = 'pallof-dessus',
}

export interface ExerciseFigure {
  /**
   * Les poses du geste, dans l'ordre : départ, puis l'autre bout ; trois pour
   * un geste en trois temps (Y, T, W). Un isométrique a l'entrée dans la
   * position, puis la position tenue.
   */
  poses: PoseInput[]
  view?: FigureView
  closeUp?: FigureCloseUp
  /** Un isométrique qui se fait en marchant : un pas, l'autre, sans tenue. */
  walking?: boolean
  /** Échelle du corps : un bonhomme allongé ne tient pas à 1 dans 120 de large. */
  scale?: number
  props: Prop[]
  /** La pose figée des vignettes : la dernière par défaut, celle qui se reconnaît. */
  keyPose?: number
}
