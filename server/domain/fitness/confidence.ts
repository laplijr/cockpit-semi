import type { Projection } from './projection'

/** La demi-largeur de l'intervalle vaut deux écarts-types (§ 5). */
export const DEVIATIONS_PER_INTERVAL = 2

/** La confiance s'arrondit aux 2 % : plus fin serait une fausse précision (§ 5). */
export const CONFIDENCE_STEP_PCT = 2

/**
 * Bornes affichées. Une projection ne peut pas être plus sûre que son propre
 * intervalle : annoncer 100 % reviendrait à promettre un chrono six mois à
 * l'avance, en supposant certain un gain de forme qui ne l'est pas.
 */
export const MIN_CONFIDENCE_PCT = 2
export const MAX_CONFIDENCE_PCT = 98

/**
 * Fonction de répartition de la loi normale centrée réduite, par
 * l'approximation d'Abramowitz-Stegun. Suffisante à 10⁻⁷ près, et sans
 * dépendance pour une seule formule.
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2

  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)

  return 0.5 * (1 + sign * erf)
}

export interface ConfidenceTarget {
  /** Chrono visé, ou référence à battre en performance maximale (§ 5). */
  targetS: number | null
}

/**
 * Probabilité de tenir l'objectif, en pourcentage arrondi aux 2 %. Nulle quand
 * il n'y a ni objectif ni référence : une confiance sans cible ne veut rien
 * dire, et l'écran l'affiche vide plutôt que d'inventer un chiffre (§ 5).
 */
export function confidence(projection: Projection, { targetS }: ConfidenceTarget): number | null {
  if (targetS === null) return null

  const deviation = (projection.highS - projection.timeS) / DEVIATIONS_PER_INTERVAL
  if (deviation <= 0) {
    return targetS >= projection.timeS ? MAX_CONFIDENCE_PCT : MIN_CONFIDENCE_PCT
  }

  const probability = normalCdf((targetS - projection.timeS) / deviation)
  const rounded = Math.round((probability * 100) / CONFIDENCE_STEP_PCT) * CONFIDENCE_STEP_PCT

  return Math.min(MAX_CONFIDENCE_PCT, Math.max(MIN_CONFIDENCE_PCT, rounded))
}
