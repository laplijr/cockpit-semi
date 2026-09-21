import type { IsoDate } from '../plan/calendar'
import { addDays } from '../plan/calendar'
import { Sport } from '../shared/sport'

/** Tolérance de rattachement : même sport à ± 1 jour d'une séance prévue (§ 7.4). */
export const MATCH_WINDOW_DAYS = 1

/** RPE retenu quand la fréquence cardiaque ne permet pas de le déduire. */
export const DEFAULT_ESTIMATED_RPE = 5

export interface ImportedActivity {
  externalId: string
  sport: Sport
  date: IsoDate
  durationS: number
  averageHr?: number | null
}

/**
 * Écart de durée sous lequel deux activités du même jour et du même sport sont
 * la même sortie. Depuis P10 une séance peut être courue dans l'app puis
 * réimportée depuis la montre : sans cette reconnaissance, la séance étant
 * déjà faite, le fichier tomberait « hors plan » et la charge du jour
 * compterait la sortie deux fois.
 */
export const SAME_OUTING_TOLERANCE = 0.1

export function isSameOuting(
  activity: Pick<ImportedActivity, 'sport' | 'date' | 'durationS'>,
  known: Pick<ImportedActivity, 'sport' | 'date' | 'durationS'>,
): boolean {
  if (activity.sport !== known.sport || activity.date !== known.date) return false

  const longest = Math.max(activity.durationS, known.durationS)
  if (longest <= 0) return false

  return Math.abs(activity.durationS - known.durationS) / longest <= SAME_OUTING_TOLERANCE
}

export interface CandidateSession {
  id: number
  date: IsoDate
  sport: Sport
  /** Une séance déjà rattachée ne peut pas l'être une seconde fois. */
  alreadyMatched: boolean
}

export interface MatchToSession {
  kind: 'session'
  sessionId: number
}

export interface MatchAsUnplanned {
  kind: 'unplanned'
  estimatedRpe: number
}

export type MatchResult = MatchToSession | MatchAsUnplanned

/**
 * RPE déduit de la fréquence cardiaque moyenne, rapportée à la FC max.
 * Sans FC max ni FC moyenne, on retient une valeur neutre plutôt que d'inventer.
 */
export function estimateRpe(averageHr?: number | null, maxHr?: number | null): number {
  if (!averageHr || !maxHr || maxHr <= 0) return DEFAULT_ESTIMATED_RPE

  const intensity = averageHr / maxHr
  const rpe = Math.round((intensity - 0.5) * 20)
  return Math.min(10, Math.max(1, rpe))
}

/**
 * Rattache une activité importée à la séance prévue la plus proche, à sport
 * identique et à un jour près. À défaut, l'activité devient un imprévu dont la
 * charge est estimée.
 */
export function matchActivity(
  activity: ImportedActivity,
  sessions: CandidateSession[],
  maxHr?: number | null,
): MatchResult {
  const from = addDays(activity.date, -MATCH_WINDOW_DAYS)
  const to = addDays(activity.date, MATCH_WINDOW_DAYS)

  const candidates = sessions
    .filter((session) => !session.alreadyMatched)
    .filter((session) => session.sport === activity.sport)
    .filter((session) => session.date >= from && session.date <= to)

  if (candidates.length === 0) {
    return { kind: 'unplanned', estimatedRpe: estimateRpe(activity.averageHr, maxHr) }
  }

  const distance = (session: CandidateSession) =>
    Math.abs(Date.parse(session.date) - Date.parse(activity.date))

  const best = candidates.reduce((closest, session) =>
    distance(session) < distance(closest) ? session : closest,
  )

  return { kind: 'session', sessionId: best.id }
}

/** Sport Strava → sport du cockpit. Tout ce qui n'est pas reconnu tombe en « autre ». */
export function sportFromStrava(type: string): Sport {
  const normalised = type.toLowerCase()
  if (normalised.includes('run')) return Sport.Running
  if (normalised.includes('ride') || normalised.includes('cycl')) return Sport.Cycling
  if (normalised.includes('weight') || normalised.includes('workout')) return Sport.Strength
  return Sport.Other
}
