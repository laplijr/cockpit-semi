/**
 * Habitudes détectées par observation, sans apprentissage automatique (§ 5).
 * Chacune est une statistique simple sur ce qui s'est réellement passé ; elle
 * ne devient une règle que si Ronan l'accepte.
 */
export enum HabitType {
  /** La séance X finit régulièrement déplacée vers le jour Y. */
  DayShift = 'glissement_de_jour',
  /** Un jour de la semaine où rien n'est jamais fait. */
  DeadSlot = 'creneau_jamais_honore',
  /** Un type de séance systématiquement plus dur (ou plus facile) que prévu. */
  RpeBias = 'biais_rpe',
  /** Une nuit courte se paie sur la séance du lendemain. */
  SleepSensitivity = 'sensibilite_sommeil',
  /** Une famille de propositions refusée presque à chaque fois. */
  ProposalRefusal = 'refus_systematique',
}

export enum HabitStatus {
  Detected = 'detectee',
  Accepted = 'acceptee',
  Refused = 'refusee',
}

/** Seuils du § 5 : en dessous, la statistique ne veut rien dire. */
export const HABIT_THRESHOLDS = {
  dayShift: { minOccurrences: 8, minShare: 0.6 },
  deadSlot: { minOccurrences: 8 },
  rpeBias: { minSamples: 6, minBias: 0.5 },
  sleepSensitivity: { minCases: 5, minExcess: 1 },
  proposalRefusal: { minDecisions: 5, minShare: 0.7 },
} as const

export interface DetectedHabit {
  type: HabitType
  /**
   * Identifiant stable du sujet observé : une nouvelle détection du même sujet
   * remplace la précédente au lieu de s'empiler.
   */
  key: string
  parameters: Record<string, number | string>
  /** Preuve : n cas sur N observés. */
  matched: number
  total: number
  /** 0 à 1. Part observée, tempérée par la taille de l'échantillon. */
  confidence: number
  /** Ce que la règle ferait, en une phrase, telle qu'elle s'affiche. */
  statement: string
}

/**
 * Confiance = part observée × maturité de l'échantillon. Un 8/8 tout juste au
 * seuil ne vaut pas un 30/30 : la maturité plafonne à 1 au double du seuil.
 */
export function confidenceOf(matched: number, total: number, minSample: number): number {
  if (total === 0) return 0
  const share = matched / total
  const maturity = Math.min(1, total / (2 * minSample))
  return Math.round(share * maturity * 100) / 100
}
