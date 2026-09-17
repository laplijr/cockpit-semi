import type { Range } from './daily'

/**
 * Trois régimes de course (§ 5). La frontière est la durée projetée, pas la
 * distance : un semi à 6:10/km dure plus de deux heures et se ravitaille, un
 * 10 km rapide ne se ravitaille pas.
 */
export enum FuelTier {
  Short = 'court',
  Medium = 'moyen',
  Long = 'long',
}

export const TIER_BOUNDS_S = { short: 60 * 60, medium: 90 * 60 } as const

/** Au-delà, le § 5 ajoute le sodium : on transpire salé et longtemps. */
export const HOT_TEMP_C = 20

export enum FuelProduct {
  Water = 'eau',
  Gel = 'gel',
  Drink = 'boisson',
}

export interface FuelIntake {
  /** Minute de course de la prise. */
  minute: number
  /** Kilomètre correspondant à l'allure projetée. */
  km: number
  product: FuelProduct
  quantity: string
  /** Vrai quand la prise est un confort, pas un besoin. */
  optional: boolean
}

export interface PreRaceFuel {
  /** Glucides 2 à 3 h avant, en g/kg. */
  carbsGPerKg: Range
  waterMl: Range
  /** Caféine optionnelle à −45′, en mg/kg. */
  caffeineMgPerKg: number
}

export interface FuelPlan {
  tier: FuelTier
  durationS: number
  distanceM: number
  tempC: number | null
  preRace: PreRaceFuel
  carbsGPerHour: Range | null
  waterMlPerHour: Range | null
  sodiumMgPerHour: Range | null
  intakes: FuelIntake[]
  notes: string[]
  generatedAt: string
}

export const PRE_RACE: PreRaceFuel = {
  carbsGPerKg: [1, 2],
  waterMl: [300, 500],
  caffeineMgPerKg: 3,
}

const TESTED_NOTE =
  'Chaque produit de cette liste doit avoir été essayé en sortie longue : rien de nouveau le jour de la course.'

export interface FuelPlanInput {
  /** Durée projetée en secondes. */
  durationS: number
  distanceM: number
  /** Température attendue ; nulle quand elle n'est pas renseignée. */
  tempC: number | null
  generatedAt: string
}

export function tierOf(durationS: number): FuelTier {
  if (durationS < TIER_BOUNDS_S.short) return FuelTier.Short
  if (durationS <= TIER_BOUNDS_S.medium) return FuelTier.Medium
  return FuelTier.Long
}

/** Eau par heure selon la chaleur attendue ; le § 5 donne la plage 400–800 ml. */
export function waterPerHour(tempC: number | null): Range {
  if (tempC === null) return [500, 650]
  if (tempC <= 10) return [400, 500]
  if (tempC <= HOT_TEMP_C) return [500, 650]
  return [650, 800]
}

export function buildFuelPlan(input: FuelPlanInput): FuelPlan {
  const tier = tierOf(input.durationS)
  const paceSPerKm = input.distanceM > 0 ? input.durationS / (input.distanceM / 1000) : 0
  const kmAt = (minute: number) =>
    paceSPerKm === 0 ? 0 : Math.round(((minute * 60) / paceSPerKm) * 10) / 10

  const base = {
    tier,
    durationS: input.durationS,
    distanceM: input.distanceM,
    tempC: input.tempC,
    preRace: PRE_RACE,
    generatedAt: input.generatedAt,
  }

  if (tier === FuelTier.Short) {
    return {
      ...base,
      carbsGPerHour: null,
      waterMlPerHour: null,
      sodiumMgPerHour: null,
      intakes: [],
      notes: ['Moins d’une heure de course : rien à prendre pendant, tout se joue avant.'],
    }
  }

  if (tier === FuelTier.Medium) {
    return {
      ...base,
      carbsGPerHour: null,
      waterMlPerHour: waterPerHour(input.tempC),
      sodiumMgPerHour: null,
      intakes: mediumIntakes(input.durationS, kmAt),
      notes: [TESTED_NOTE],
    }
  }

  return {
    ...base,
    carbsGPerHour: [30, 60],
    waterMlPerHour: waterPerHour(input.tempC),
    sodiumMgPerHour: input.tempC !== null && input.tempC > HOT_TEMP_C ? [300, 600] : null,
    intakes: longIntakes(input.durationS, kmAt),
    notes: [TESTED_NOTE, ...hotNote(input.tempC)],
  }
}

/** 60–90′ : de l'eau tous les 20′, un gel optionnel à mi-course (§ 5). */
function mediumIntakes(durationS: number, kmAt: (minute: number) => number): FuelIntake[] {
  const minutes = Math.floor(durationS / 60)
  const intakes: FuelIntake[] = []

  for (let minute = 20; minute < minutes; minute += 20) {
    intakes.push({
      minute,
      km: kmAt(minute),
      product: FuelProduct.Water,
      quantity: '150 à 250 ml',
      optional: false,
    })
  }

  const half = Math.round(minutes / 2)
  intakes.push({
    minute: half,
    km: kmAt(half),
    product: FuelProduct.Gel,
    quantity: '1 gel',
    optional: true,
  })

  return intakes.sort((a, b) => a.minute - b.minute)
}

/**
 * Au-delà de 90′ : 30 à 60 g de glucides par heure dès la 20e minute, soit un
 * gel de 20 à 25 g toutes les 25 à 30′, et de l'eau tous les 20′ (§ 5).
 */
function longIntakes(durationS: number, kmAt: (minute: number) => number): FuelIntake[] {
  const minutes = Math.floor(durationS / 60)
  const intakes: FuelIntake[] = []

  for (let minute = 20; minute < minutes - 5; minute += 25) {
    intakes.push({
      minute,
      km: kmAt(minute),
      product: FuelProduct.Gel,
      quantity: '1 gel de 20 à 25 g',
      optional: false,
    })
  }

  for (let minute = 20; minute < minutes; minute += 20) {
    intakes.push({
      minute,
      km: kmAt(minute),
      product: FuelProduct.Water,
      quantity: '150 à 250 ml',
      optional: false,
    })
  }

  return intakes.sort((a, b) => a.minute - b.minute || a.product.localeCompare(b.product))
}

function hotNote(tempC: number | null): string[] {
  if (tempC === null || tempC <= HOT_TEMP_C) return []
  return [
    `${tempC} °C attendus : boire au haut de la fourchette et prendre le sodium dès la première heure.`,
  ]
}
