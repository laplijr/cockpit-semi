import { addDays, type IsoDate } from '../plan/calendar'
import { Sport } from '../shared/sport'
import { RATIO_REFERENCE, loadRatio, type DailyLoad } from './load'

/** La charge qu'une séance encore prévue apportera : `RPE attendu × durée prescrite`. */
export interface PlannedLoad {
  date: IsoDate
  sport: Sport
  units: number
}

/**
 * Les charges journalières prolongées par le plan (P22). Jusqu'à hier, le
 * réalisé seul : une séance passée sans nouvelles compte zéro (P20). À partir
 * d'aujourd'hui, le réalisé plus le prescrit des séances encore prévues. La
 * frise dit donc ce qui arrive si le plan est tenu à partir d'aujourd'hui.
 */
export function projectLoads(
  actual: readonly DailyLoad[],
  planned: readonly PlannedLoad[],
  today: IsoDate,
): DailyLoad[] {
  const byDate = new Map<IsoDate, DailyLoad>(
    actual.map((day) => [day.date, { ...day, bySport: { ...day.bySport } }]),
  )

  for (const item of planned) {
    if (item.date < today) continue
    const day = byDate.get(item.date) ?? {
      date: item.date,
      bySport: { [Sport.Running]: 0, [Sport.Cycling]: 0, [Sport.Strength]: 0, [Sport.Other]: 0 },
      total: 0,
    }
    day.bySport[item.sport] += item.units
    day.total += item.units
    byDate.set(item.date, day)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface RatioPoint {
  date: IsoDate
  /** Nul tant que l'historique est trop court ou la fenêtre chronique vide. */
  ratio: number | null
  /** Vrai après aujourd'hui : le point vient du plan, pas du réalisé. */
  projected: boolean
}

/** Le ratio 7 j / 21 j de chaque jour, calculé comme le cadran le calcule. */
export function ratioSeries(
  loads: readonly DailyLoad[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
): RatioPoint[] {
  const first = loads[0]?.date
  const points: RatioPoint[] = []

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const historyDays = first
      ? Math.round((Date.parse(date) - Date.parse(first)) / 86_400_000) + 1
      : 0
    const ratio = loadRatio([...loads], date, historyDays)?.ratio ?? null
    points.push({ date, ratio, projected: date > today })
  }

  return points
}

const inBand = (ratio: number) => ratio >= RATIO_REFERENCE.low && ratio <= RATIO_REFERENCE.high

/**
 * Le premier jour projeté où la courbe sort de la bande 0,8–1,3 : un
 * franchissement, depuis un jour dans la bande. Une courbe déjà dehors
 * aujourd'hui ne « sort » pas demain.
 */
export function firstExitFromBand(points: readonly RatioPoint[]): RatioPoint | undefined {
  return points.find((point, index) => {
    const before = points[index - 1]
    return (
      point.projected &&
      point.ratio !== null &&
      !inBand(point.ratio) &&
      before?.ratio !== null &&
      before?.ratio !== undefined &&
      inBand(before.ratio)
    )
  })
}
