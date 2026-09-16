/** Dates ISO `YYYY-MM-DD` manipulées en UTC : pas de fuseau, pas de dérive. */
export type IsoDate = string

const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS

export function toUtc(date: IsoDate): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!)
}

export function toIso(timestamp: number): IsoDate {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(toUtc(date) + days * DAY_MS)
}

export function addWeeks(date: IsoDate, weeks: number): IsoDate {
  return addDays(date, weeks * 7)
}

/** 1 = lundi … 7 = dimanche. */
export function weekday(date: IsoDate): number {
  return ((new Date(toUtc(date)).getUTCDay() + 6) % 7) + 1
}

export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - weekday(date))
}

/** Nombre de semaines pleines entre deux dates, arrondi au supérieur. */
export function weeksBetween(from: IsoDate, to: IsoDate): number {
  return Math.ceil((toUtc(to) - toUtc(from)) / WEEK_MS)
}
