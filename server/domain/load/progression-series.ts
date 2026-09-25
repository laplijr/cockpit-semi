import { addDays, type IsoDate } from '../plan/calendar'
import { SessionStatus } from '../plan/session'
import { strengthExercise } from '../strength/exercises'

export interface DatedSession {
  date: IsoDate
  status: SessionStatus
}

export interface SessionDay {
  date: IsoDate
  sessions: number
}

/** Une ligne par jour de la période, pour compter les jours sans rien (§ 9, P6). */
export function sessionDays(sessions: DatedSession[], today: IsoDate): SessionDay[] {
  const done = new Map<IsoDate, number>()
  for (const item of sessions) {
    if (item.status === SessionStatus.Done) done.set(item.date, (done.get(item.date) ?? 0) + 1)
  }

  const firstDay = sessions.map((item) => item.date).sort()[0] ?? today
  const days: SessionDay[] = []
  for (let cursor = firstDay; cursor <= today; cursor = addDays(cursor, 1)) {
    days.push({ date: cursor, sessions: done.get(cursor) ?? 0 })
  }
  return days
}

export interface HeldLoad {
  date: IsoDate
  exerciseId: string
  loadKg: number
}

export interface StrengthSeries {
  exerciseId: string
  label: string
  points: { date: IsoDate; loadKg: number }[]
}

/**
 * Charges tenues par exercice, dans l'ordre du temps (§ 9, P6). Une séance
 * vaut un point, le plus lourd du jour. Un exercice au poids du corps n'a pas
 * de charge à suivre — sa courbe serait une droite à zéro —, et un seul point
 * ne dessine rien : on ne garde que ce qui se charge et se répète.
 */
export function strengthSeries(sets: HeldLoad[]): StrengthSeries[] {
  const byExercise = new Map<string, { date: IsoDate; loadKg: number }[]>()
  for (const set of sets) {
    const previous = byExercise.get(set.exerciseId) ?? []
    const last = previous.at(-1)
    if (last?.date === set.date) last.loadKg = Math.max(last.loadKg, set.loadKg)
    else byExercise.set(set.exerciseId, [...previous, { date: set.date, loadKg: set.loadKg }])
  }

  return [...byExercise.entries()]
    .map(([exerciseId, points]) => ({
      exerciseId,
      label: strengthExercise(exerciseId)?.label ?? exerciseId,
      points,
    }))
    .filter((series) => series.points.length > 1)
    .filter((series) => series.points.some((point) => point.loadKg > 0))
    .sort((a, b) => b.points.length - a.points.length)
}

/** Vrai quand une pause recouvre la semaine, même en partie : elle l'excuse. */
export function coveredByPause(
  startDate: IsoDate,
  endDate: IsoDate,
  pauses: { startDate: IsoDate; endDate: IsoDate | null }[],
): boolean {
  return pauses.some(
    (row) => row.startDate <= endDate && (row.endDate ?? '9999-12-31') >= startDate,
  )
}
