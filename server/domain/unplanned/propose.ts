import type { IsoDate } from '../plan/calendar'
import { addDays, startOfWeek } from '../plan/calendar'
import type { Proposal, UpcomingSession } from '../rules/rules'
import { MIN_HOURS_BETWEEN_KEY_SESSIONS, ProposalEffect, RuleId } from '../rules/rules'
import { Sport } from '../shared/sport'
import type { UnplannedUnavailability } from './events'
import { UnavailabilityScope, coversDate } from './events'

const SCOPE_SPORTS: Record<UnavailabilityScope, Sport | null> = {
  [UnavailabilityScope.All]: null,
  [UnavailabilityScope.Running]: Sport.Running,
  [UnavailabilityScope.Cycling]: Sport.Cycling,
  [UnavailabilityScope.Strength]: Sport.Strength,
}

/** Une indisponibilité de portée « tout » touche chaque sport. */
function affects(unavailability: UnplannedUnavailability, session: UpcomingSession): boolean {
  if (!coversDate(unavailability, session.date)) return false
  const sport = SCOPE_SPORTS[unavailability.scope]
  return sport === null || sport === session.sport
}

export interface UnplannedContext {
  /** Séances à venir, au moins celles de la semaine touchée. */
  upcoming: UpcomingSession[]
}

const HOURS_PER_DAY = 24

/**
 * Jour d'accueil d'une séance clé déplacée : dans la même semaine, sans séance
 * déjà posée, hors indisponibilité, et à 48 h au moins de la séance clé
 * suivante (§ 5, R6). Sans jour valable, la séance est retirée.
 */
function landingDay(
  session: UpcomingSession,
  unavailability: UnplannedUnavailability,
  upcoming: UpcomingSession[],
): IsoDate | undefined {
  const monday = startOfWeek(session.date)
  const busy = new Set(upcoming.map((item) => item.date))
  const keyDates = upcoming
    .filter((item) => item.key && item.sessionId !== session.sessionId)
    .map((item) => item.date)

  const gapDays = MIN_HOURS_BETWEEN_KEY_SESSIONS / HOURS_PER_DAY

  for (let offset = 0; offset < 7; offset++) {
    const candidate = addDays(monday, offset)
    if (busy.has(candidate)) continue
    if (coversDate(unavailability, candidate)) continue
    if (keyDates.some((date) => Math.abs(daysBetween(date, candidate)) < gapDays)) continue
    return candidate
  }

  return undefined
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/**
 * Règle I1 — une indisponibilité déclarée en texte libre couvre des séances
 * prévues : les séances clés sont proposées à un autre jour de la semaine,
 * les autres au retrait. Rien n'est appliqué ici (§ 1.3).
 */
export function proposeForUnavailabilities(
  unavailabilities: UnplannedUnavailability[],
  { upcoming }: UnplannedContext,
): Proposal[] {
  const proposals: Proposal[] = []
  const moved = new Map<number, IsoDate>()

  for (const unavailability of unavailabilities) {
    for (const session of upcoming.filter((item) => affects(unavailability, item))) {
      if (moved.has(session.sessionId)) continue

      const remaining = upcoming.filter((item) => !moved.has(item.sessionId))
      const landing = session.key ? landingDay(session, unavailability, remaining) : undefined

      if (landing) {
        moved.set(session.sessionId, landing)
        proposals.push({
          ruleId: RuleId.I1,
          effect: ProposalEffect.MoveSession,
          target: { kind: 'session', id: session.sessionId },
          before: `${session.code} le ${session.date}`,
          after: `${session.code} le ${landing}`,
          explanation: `Tu as déclaré une indisponibilité : ${unavailability.label}.`,
          payload: { date: landing },
        })
        continue
      }

      moved.set(session.sessionId, session.date)
      proposals.push({
        ruleId: RuleId.I1,
        effect: ProposalEffect.CancelSession,
        target: { kind: 'session', id: session.sessionId },
        before: `${session.code} le ${session.date}`,
        after: 'séance retirée, sans rattrapage',
        explanation: `Tu as déclaré une indisponibilité : ${unavailability.label}.`,
      })
    }
  }

  return proposals
}
