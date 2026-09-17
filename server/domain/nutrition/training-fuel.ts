import type { Range } from './daily'

/**
 * Ravitaillement d'entraînement : ce qu'on emporte sur une séance. Le seuil est
 * la durée, pas l'intensité — au-delà d'environ 75 minutes les réserves de
 * glycogène deviennent le facteur limitant.
 */
export const TRAINING_BOUNDS_MIN = { water: 75, moderate: 120 } as const

export interface TrainingFuel {
  carbsGPerHour: Range | null
  waterMlPerHour: Range
  advice: string
}

export function trainingFuelFor(durationMin: number, rehearsesRacePace = false): TrainingFuel {
  if (durationMin < TRAINING_BOUNDS_MIN.water) {
    return {
      carbsGPerHour: null,
      waterMlPerHour: [300, 500],
      advice: 'Moins de 75 minutes : de l’eau suffit.',
    }
  }

  if (durationMin <= TRAINING_BOUNDS_MIN.moderate) {
    return {
      carbsGPerHour: [30, 40],
      waterMlPerHour: [400, 600],
      advice: rehearsesRacePace
        ? 'Sortie longue à l’allure de course : c’est la répétition du ravito de course, prends les produits du jour J.'
        : 'Au-delà de 75 minutes : un gel ou une boisson glucidique par heure.',
    }
  }

  return {
    carbsGPerHour: [60, 80],
    waterMlPerHour: [500, 700],
    advice:
      'Au-delà de deux heures : monter à 60 g de glucides par heure, en deux sources (glucose et fructose) pour l’absorption.',
  }
}
