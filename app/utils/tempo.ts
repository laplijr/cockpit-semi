/**
 * Un tempo en quatre temps, « 2-0-X-0 » : descente, pause en bas, remontée,
 * pause en haut (P25). X est une remontée explosive, jouée en 0,6 s. Sans
 * tempo prescrit, 1,5 s par sens et pas de pause.
 */
export const EXPLOSIVE_S = 0.6
const DEFAULT_PHASES = [1.5, 0, 1.5, 0] as const

export type TempoPhases = readonly [number, number, number, number]

export function tempoPhases(tempo: string | undefined): TempoPhases {
  const parts = tempo?.split('-')
  if (!parts || parts.length !== 4) return DEFAULT_PHASES
  const [down, low, up, high] = parts.map((part) => (part === 'X' ? EXPLOSIVE_S : Number(part)))
  if ([down, low, up, high].some((value) => Number.isNaN(value))) return DEFAULT_PHASES
  return [down!, low!, up!, high!]
}

/** « descente 2″, remontée explosive », « descente 3″, pause 1″ en bas, remontée 2″ ». */
export function tempoWords(tempo: string | undefined): string | null {
  const parts = tempo?.split('-')
  if (!parts || parts.length !== 4) return null
  const [down, low, up, high] = parts
  const words = [`descente ${down}″`]
  if (low !== '0') words.push(`pause ${low}″ en bas`)
  words.push(up === 'X' ? 'remontée explosive' : `remontée ${up}″`)
  if (high !== '0') words.push(`pause ${high}″ en haut`)
  return words.join(', ')
}

/**
 * Où en est le geste à l'instant `seconds` : 0 à la pose de départ, 1 à
 * l'autre bout. La descente se fait en douceur, la remontée explosive d'un
 * trait.
 */
export function tempoProgress(phases: TempoPhases, seconds: number): number {
  const [down, low, up, high] = phases
  const cycle = down + low + up + high
  let time = seconds % cycle
  const ease = (value: number) => value * value * (3 - 2 * value)

  if (time < down) return ease(time / down)
  time -= down
  if (time < low) return 1
  time -= low
  if (time < up) return 1 - (up <= EXPLOSIVE_S ? time / up : ease(time / up))
  return 0
}

/** Un isométrique : entrer dans la position, la tenir, en sortir. */
export const HOLD_PHASES: TempoPhases = [1.2, 3, 1.2, 0.8]

/** Une marche chargée : un pas, puis l'autre. */
export const WALK_PHASES: TempoPhases = [0.6, 0, 0.6, 0]

const SEQUENCE_MOVE_S = 1.2
const SEQUENCE_HOLD_S = 0.6

/**
 * Un geste en plusieurs temps (Y, T, W) : de pose en pose, puis retour, en
 * marquant chaque position. Rend l'indice fractionnaire de la pose, de 0 à
 * `count − 1`.
 */
export function sequenceProgress(count: number, seconds: number): number {
  const legs = (count - 1) * 2
  const leg = SEQUENCE_MOVE_S + SEQUENCE_HOLD_S
  const time = seconds % (legs * leg)
  const index = Math.floor(time / leg)
  const within = Math.min(1, (time - index * leg) / SEQUENCE_MOVE_S)
  const eased = within * within * (3 - 2 * within)
  return index < count - 1 ? index + eased : legs - index - eased
}
