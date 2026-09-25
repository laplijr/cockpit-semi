import { EMPTY_ADJUSTMENTS } from '../learning/personal-rules'
import { addDays, weekday as weekdayOf } from '../plan/calendar'
import { frenchShortDate } from '../shared/french'
import {
  MAX_TARGETS_PER_RULE,
  ProposalEffect,
  RuleId,
  type Proposal,
  type RuleContext,
  type UpcomingSession,
} from './rule-types'

/**
 * R100 et R101 — apprises : replacer une séance du jour prévu vers le jour
 * réellement tenu, et vider un créneau jamais honoré. Elles ne font que
 * déplacer ; la date de destination voyage dans le `payload`, pas dans le texte.
 */
export function learnedMoves(context: RuleContext): Proposal[] {
  const personal = context.personal ?? EMPTY_ADJUSTMENTS
  if (personal.dayShifts.length === 0 && personal.deadWeekdays.length === 0) return []

  return context.upcoming
    .flatMap((session) => {
      const day = weekdayOf(session.date)
      const shift = personal.dayShifts.find(
        (entry) => entry.code === session.code && entry.fromWeekday === day,
      )
      if (shift) return [moveProposal(RuleId.R100, session, day, shift.toWeekday)]

      if (!personal.deadWeekdays.includes(day)) return []
      const destination = nextLivedDay(day, personal.deadWeekdays)
      return destination === null ? [] : [moveProposal(RuleId.R101, session, day, destination)]
    })
    .slice(0, MAX_TARGETS_PER_RULE)
}

const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function moveProposal(
  ruleId: RuleId,
  session: UpcomingSession,
  from: number,
  to: number,
): Proposal {
  const date = addDays(session.date, (((to - from) % 7) + 7) % 7)
  return {
    ruleId,
    effect: ProposalEffect.MoveSession,
    target: { kind: 'session', id: session.sessionId },
    before: `${WEEKDAY_NAMES[from - 1]} ${frenchShortDate(session.date)}`,
    after: `${WEEKDAY_NAMES[to - 1]} ${frenchShortDate(date)}`,
    explanation:
      ruleId === RuleId.R100
        ? 'Habitude acceptée : cette séance se fait ce jour-là.'
        : 'Habitude acceptée : rien ne se fait ce jour-là.',
    payload: { date },
  }
}

/** Premier jour suivant qui n'est pas lui-même un créneau mort. */
function nextLivedDay(from: number, dead: number[]): number | null {
  for (let step = 1; step < 7; step += 1) {
    const day = ((from - 1 + step) % 7) + 1
    if (!dead.includes(day)) return day
  }
  return null
}

/** R102 — apprise : le RPE attendu d'un type de séance est recalé. */
export function learnedRpe(context: RuleContext): Proposal[] {
  const biases = context.personal?.rpeBias ?? []
  if (biases.length === 0) return []

  return context.upcoming
    .flatMap((session) => {
      const bias = biases.find((entry) => entry.code === session.code)
      if (!bias || session.expectedRpe === undefined) return []

      const adjusted = Math.min(10, Math.max(1, session.expectedRpe + bias.bias))
      if (adjusted === session.expectedRpe) return []

      return [
        {
          ruleId: RuleId.R102,
          effect: ProposalEffect.AdjustExpectedRpe,
          target: { kind: 'session' as const, id: session.sessionId },
          before: `RPE ${session.expectedRpe}`,
          after: `RPE ${adjusted}`,
          explanation: 'Habitude acceptée : cette séance se ressent autrement que prévu.',
          payload: { expectedRpe: adjusted },
        },
      ]
    })
    .slice(0, MAX_TARGETS_PER_RULE)
}
