import { addDays, startOfWeek, type IsoDate } from './calendar'
import type { RecentRun } from './generate'

/** Semaines closes lues pour le volume tenu (§ 5, Volume et blocs). */
export const HELD_VOLUME_WEEKS = 3

/**
 * Le volume tenu : la plus forte des trois dernières semaines closes, en
 * mètres courus. La plus forte et non la moyenne : une semaine allégée par le
 * moteur tirerait la base vers le bas pour rien. Nul quand une de ces
 * semaines n'a aucune course — une semaine vide dit un historique incomplet
 * ou une coupure, pas un volume, et le volume déclaré reprend la main.
 */
export function heldWeeklyVolume(runs: RecentRun[], today: IsoDate): number | null {
  const thisMonday = startOfWeek(today)
  const weeks = Array.from({ length: HELD_VOLUME_WEEKS }, (_, offset) => {
    const start = addDays(thisMonday, -7 * (offset + 1))
    const end = addDays(start, 6)
    return runs.filter((run) => run.date >= start && run.date <= end)
  })
  if (weeks.some((week) => week.length === 0)) return null

  return Math.max(...weeks.map((week) => week.reduce((total, run) => total + run.distanceM, 0)))
}
