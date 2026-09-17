import { addDays, type IsoDate } from '../plan/calendar'
import { DayKind, gramsFor, type Range } from './daily'
import { FuelTier, PRE_RACE, type FuelPlan } from './fuel-plan'

/** Le protocole se déclenche à J−7 (§ 9, P6). */
export const PROTOCOL_DAYS = 7

export interface ProtocolDay {
  date: IsoDate
  /** 7 à 0, le jour de la course. */
  daysBefore: number
  carbsGPerKg: Range
  carbsG: Range | null
  headline: string
  details: string[]
}

export interface RaceWeekInput {
  raceDate: IsoDate
  weightKg: number | null
  /** Nul quand le plan ravito n'a pas encore été généré. */
  fuelPlan: FuelPlan | null
}

/**
 * Sept jours avant la course : la charge glucidique ne dure que les trois
 * derniers jours, le reste de la semaine reste normal. Une charge de sept jours
 * n'ajoute rien et alourdit.
 */
const CARBS_BY_DAY: Record<number, Range> = {
  7: [5, 7],
  6: [5, 7],
  5: [5, 7],
  4: [5, 7],
  3: [8, 10],
  2: [8, 10],
  1: [8, 10],
  0: [8, 10],
}

export function raceWeekProtocol(input: RaceWeekInput): ProtocolDay[] {
  return Object.keys(CARBS_BY_DAY)
    .map(Number)
    .sort((a, b) => b - a)
    .map((daysBefore) => {
      const carbsGPerKg = CARBS_BY_DAY[daysBefore]!
      return {
        date: addDays(input.raceDate, -daysBefore),
        daysBefore,
        carbsGPerKg,
        carbsG: gramsFor(carbsGPerKg, input.weightKg),
        headline: HEADLINES[daysBefore]!,
        details: detailsFor(daysBefore, input),
      }
    })
}

const HEADLINES: Record<number, string> = {
  7: 'Semaine normale',
  6: 'Semaine normale',
  5: 'Semaine normale',
  4: 'Semaine normale',
  3: 'Début de la charge glucidique',
  2: 'Charge glucidique',
  1: 'Veille',
  0: 'Jour de course',
}

function detailsFor(daysBefore: number, input: RaceWeekInput): string[] {
  if (daysBefore >= 4) {
    return ['Alimentation habituelle : le volume baisse, les glucides suivent la charge.']
  }

  if (daysBefore === 3) {
    return [
      'Monter les glucides et baisser les fibres : la charge se fait sur des sucres lents digestes.',
      'Boire régulièrement dans la journée, sans forcer d’un coup.',
    ]
  }

  if (daysBefore === 2) {
    return [
      'Deuxième jour de charge : trois repas glucidiques et deux collations.',
      'Pas d’aliment nouveau à partir d’aujourd’hui.',
    ]
  }

  if (daysBefore === 1) {
    return [
      'Dernier vrai repas glucidique à midi ; dîner léger, pauvre en fibres, sans alcool.',
      'Saler un peu plus les repas et surveiller la couleur des urines.',
    ]
  }

  return raceDayDetails(input)
}

function raceDayDetails(input: RaceWeekInput): string[] {
  const carbs = gramsFor(PRE_RACE.carbsGPerKg, input.weightKg)
  const caffeine =
    input.weightKg === null ? null : Math.round(PRE_RACE.caffeineMgPerKg * input.weightKg)

  const details = [
    carbs
      ? `Petit-déjeuner 2 à 3 h avant : ${carbs[0]} à ${carbs[1]} g de glucides, ${PRE_RACE.waterMl[0]} à ${PRE_RACE.waterMl[1]} ml d’eau.`
      : `Petit-déjeuner 2 à 3 h avant : ${PRE_RACE.carbsGPerKg[0]} à ${PRE_RACE.carbsGPerKg[1]} g de glucides par kilo, ${PRE_RACE.waterMl[0]} à ${PRE_RACE.waterMl[1]} ml d’eau.`,
    caffeine
      ? `Caféine optionnelle à −45′ : environ ${caffeine} mg.`
      : `Caféine optionnelle à −45′ : ${PRE_RACE.caffeineMgPerKg} mg par kilo.`,
  ]

  if (input.fuelPlan && input.fuelPlan.tier !== FuelTier.Short) {
    details.push(`Pendant la course : ${input.fuelPlan.intakes.length} prises, plan ci-dessous.`)
  }

  return details
}

/** Type de journée d'un jour de protocole, pour les repères quotidiens. */
export function dayKindOfProtocol(daysBefore: number): DayKind {
  return daysBefore === 0 ? DayKind.Race : DayKind.Easy
}
