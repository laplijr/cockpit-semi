import type { MealEmphasis, MealKind } from './meal-timing'

/**
 * Un repas proposé pour un jour donné : l'heure et le rôle viennent du moteur
 * (`mealTiming`), le nom et la description viennent du modèle (§ 6, P6.4).
 */
export interface Meal {
  kind: MealKind
  /** Heure décimale du créneau : 7,5 vaut 7 h 30. */
  hour: number
  emphasis: MealEmphasis
  name: string
  description: string
}

/**
 * Signature des séances d'un jour. Deux générations pour le même jour partent
 * des mêmes séances ou d'un plan qui a bougé : cette clé les départage sans
 * garder une copie de la prescription.
 */
export function sessionsKeyOf(sessions: { sport: string; code: string; durationMin: number }[]) {
  return sessions
    .map((session) => `${session.sport}:${session.code}:${Math.round(session.durationMin)}`)
    .sort()
    .join('|')
}
