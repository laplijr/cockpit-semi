import type { IsoDate } from '../plan/calendar'
import { frenchSignedDecimal } from '../shared/french'

/**
 * Au-delà de cette ancienneté, un point de forme ne mesure plus rien : il
 * borne encore par le bas, il ne dit plus où on en est (§ 5, P7.5).
 */
export const FITNESS_FRESHNESS_WEEKS = 12

export interface FitnessPointLike {
  date: IsoDate
  vdot: number
  isFloor: boolean
}

export interface CurrentFitness {
  date: IsoDate
  vdot: number
  isFloor: boolean
}

function isFresh(date: IsoDate, today: IsoDate): boolean {
  const days = (Date.parse(today) - Date.parse(date)) / 86_400_000
  return days <= FITNESS_FRESHNESS_WEEKS * 7
}

/**
 * La forme courante (§ 5, P7.5). Ce n'est pas le point le plus récent : parmi
 * les points frais, c'est la mesure la plus récente s'il en existe une, sinon
 * le point le plus récent. Sans aucun point frais, c'est le plus récent de
 * tous, relu comme un plancher — sa valeur ne bouge pas.
 *
 * Sans cette règle, une allure d'endurance déclarée aujourd'hui écrasait en
 * silence un vrai chrono d'il y a deux mois.
 */
export function currentFitnessOf(
  points: readonly FitnessPointLike[],
  today: IsoDate,
): CurrentFitness | undefined {
  if (points.length === 0) return undefined

  /** Du plus récent au plus ancien ; à date égale, l'ordre reçu fait foi. */
  const ordered = [...points].sort((a, b) => b.date.localeCompare(a.date))
  const fresh = ordered.filter((point) => isFresh(point.date, today))

  if (fresh.length === 0) {
    const last = ordered[0]!
    return { date: last.date, vdot: last.vdot, isFloor: true }
  }

  const measured = fresh.find((point) => !point.isFloor)
  const chosen = measured ?? fresh[0]!
  return { date: chosen.date, vdot: chosen.vdot, isFloor: chosen.isFloor }
}

/**
 * Le point courant en mots, pour le cadran (P20) : sa nature, puis l'écart au
 * point de forme qui le précède. « mesuré · +0,6 », « plancher » pour le
 * premier point.
 */
export function fitnessVerdict(
  points: readonly FitnessPointLike[],
  current: CurrentFitness,
): string {
  const nature = current.isFloor ? 'plancher' : 'mesuré'
  const previous = [...points]
    .filter((point) => point.date < current.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .at(0)
  if (!previous) return nature
  return `${nature} · ${frenchSignedDecimal(current.vdot - previous.vdot, 1)}`
}
