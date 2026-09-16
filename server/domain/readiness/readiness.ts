import { FATIGUE_SENSATIONS, Sensation } from '../load/feedback'
import { RATIO_REFERENCE } from '../load/load'

/** Pondérations du score de forme du jour (§ 5). */
export const WEIGHTS = {
  sleep: 0.35,
  rpe: 0.3,
  sensations: 0.2,
  load: 0.15,
} as const

export const READY_THRESHOLD = 65
export const CAUTION_THRESHOLD = 40

/** Nuit de référence : en dessous, le sous-score de sommeil décroît. */
export const IDEAL_SLEEP_HOURS = 8
export const POOR_SLEEP_HOURS = 5

export enum ReadinessState {
  Ready = 'pret',
  Caution = 'vigilance',
  Rest = 'repos',
}

export interface ReadinessInput {
  sleepHours: number | null
  /** Écarts RPE réel − RPE prévu des trois dernières séances, du plus récent au plus ancien. */
  rpeDeltas: number[]
  sensations: Sensation[]
  /** Ratio de charge 7 j / 21 j ; nul tant que l'historique est trop court. */
  loadRatio: number | null
}

export interface Readiness {
  score: number
  state: ReadinessState
  /** Ce qui tire le score vers le bas, du plus pesant au moins pesant. */
  causes: string[]
  suggestion: string
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** 8 h et plus valent 1, 5 h et moins valent 0, linéaire entre les deux. */
function sleepScore(hours: number | null): number {
  if (hours === null) return 0.5
  return clamp01((hours - POOR_SLEEP_HOURS) / (IDEAL_SLEEP_HOURS - POOR_SLEEP_HOURS))
}

/** Un écart moyen de 0 vaut 1 ; un écart de +2 RPE vaut 0. */
function rpeScore(deltas: number[]): number {
  if (deltas.length === 0) return 0.5
  const mean = deltas.reduce((total, value) => total + value, 0) / deltas.length
  return clamp01(1 - mean / 2)
}

function sensationScore(sensations: Sensation[]): number {
  if (sensations.length === 0) return 0.5
  const fatigue = sensations.filter((item) =>
    (FATIGUE_SENSATIONS as readonly Sensation[]).includes(item),
  ).length
  const good = sensations.filter(
    (item) => item === Sensation.Easy || item === Sensation.FreshLegs,
  ).length
  return clamp01(0.5 + (good - fatigue) * 0.5)
}

/** Dans la zone de référence le ratio vaut 1 ; il décroît de part et d'autre. */
function loadScore(ratio: number | null): number {
  if (ratio === null) return 0.5
  if (ratio >= RATIO_REFERENCE.low && ratio <= RATIO_REFERENCE.high) return 1
  const distance =
    ratio < RATIO_REFERENCE.low ? RATIO_REFERENCE.low - ratio : ratio - RATIO_REFERENCE.high
  return clamp01(1 - distance)
}

function stateOf(score: number): ReadinessState {
  if (score >= READY_THRESHOLD) return ReadinessState.Ready
  if (score >= CAUTION_THRESHOLD) return ReadinessState.Caution
  return ReadinessState.Rest
}

const SUGGESTIONS: Record<ReadinessState, string> = {
  [ReadinessState.Ready]: 'Séance prévue telle quelle. Rien à ajuster.',
  [ReadinessState.Caution]:
    'Garde la séance mais reste sur la borne basse des allures. Si ça ne passe pas aux premières répétitions, arrête.',
  [ReadinessState.Rest]:
    'Repos ou endurance très facile. Une séance de qualité aujourd’hui coûterait plus qu’elle ne rapporte.',
}

/**
 * Forme du jour : score 0–100 pondéré (§ 5). Les données manquantes valent une
 * demi-note plutôt que zéro, pour ne pas punir l'absence de saisie.
 */
export function readiness(input: ReadinessInput): Readiness {
  const parts = [
    { key: 'sleep', weight: WEIGHTS.sleep, value: sleepScore(input.sleepHours) },
    { key: 'rpe', weight: WEIGHTS.rpe, value: rpeScore(input.rpeDeltas) },
    { key: 'sensations', weight: WEIGHTS.sensations, value: sensationScore(input.sensations) },
    { key: 'load', weight: WEIGHTS.load, value: loadScore(input.loadRatio) },
  ]

  const score = Math.round(parts.reduce((total, part) => total + part.weight * part.value, 0) * 100)
  const state = stateOf(score)

  const causes: string[] = []
  if (input.sleepHours !== null && input.sleepHours < 6) {
    causes.push(`Nuit de ${input.sleepHours} h`)
  }
  if (rpeScore(input.rpeDeltas) < 0.5) causes.push('Séances plus dures que prévu')
  if (sensationScore(input.sensations) < 0.5) causes.push('Sensations de fatigue')
  if (input.loadRatio !== null && loadScore(input.loadRatio) < 1) {
    causes.push(`Charge hors zone de référence (${input.loadRatio.toFixed(2).replace('.', ',')})`)
  }

  return { score, state, causes, suggestion: SUGGESTIONS[state] }
}
