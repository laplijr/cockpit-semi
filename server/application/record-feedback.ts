import type { Pain, Sensation } from '../domain/load/feedback'
import type { IsoDate } from '../domain/plan/calendar'
import { ProposalTrigger } from '../domain/rules/proposal-status'
import type { Proposal } from '../domain/rules/rules'
import type { Clock } from '../domain/shared/clock'

export interface FeedbackInput {
  sessionId: number
  rpe: number
  sensations: Sensation[]
  sleepHours: number | null
  pain: Pain | null
  durationMin: number
  distanceM: number | null
  notes: string | null
}

export interface DailyLoadRow {
  date: IsoDate
  runningUa: number
  cyclingUa: number
  strengthUa: number
  otherUa: number
  totalUa: number
}

/** Ce dont l'enregistrement d'un ressenti a besoin, sans savoir où c'est stocké. */
export interface FeedbackGateway {
  sessionDate(sessionId: number): Promise<IsoDate | undefined>
  saveFeedback(input: FeedbackInput): Promise<void>
  markDone(input: FeedbackInput): Promise<void>
  recomputeLoad(date: IsoDate): Promise<DailyLoadRow>
  evaluateRules(today: IsoDate, trigger: ProposalTrigger): Promise<Proposal[]>
  markSkipped(sessionId: number): Promise<void>
}

export interface RecordFeedbackResult {
  date: IsoDate
  load: DailyLoadRow
  proposals: Proposal[]
}

/**
 * Enregistre le ressenti d'une séance : la séance passe à « faite » avec son
 * réalisé, la charge du jour est recalculée, puis les règles sont évaluées.
 * C'est le ressenti qui déclenche le recalcul (§ 5).
 */
export async function recordFeedback(
  gateway: FeedbackGateway,
  clock: Clock,
  input: FeedbackInput,
): Promise<RecordFeedbackResult> {
  const date = await gateway.sessionDate(input.sessionId)
  if (!date) throw new Error(`Séance ${input.sessionId} inconnue`)

  await gateway.saveFeedback(input)
  await gateway.markDone(input)

  const load = await gateway.recomputeLoad(date)
  const proposals = await gateway.evaluateRules(clock.today(), ProposalTrigger.Feedback)

  return { date, load, proposals }
}

/** Séance manquée : pas de rattrapage, pas de ressenti, mais l'état est enregistré (§ 5, R6). */
export async function skipSession(gateway: FeedbackGateway, sessionId: number): Promise<void> {
  await gateway.markSkipped(sessionId)
}

/**
 * Séance déclarée manquée par Ronan : comme un ressenti, elle relance les
 * règles, et R6 peut proposer de replacer une séance clé tout de suite.
 */
export async function recordMissed(
  gateway: FeedbackGateway,
  clock: Clock,
  sessionId: number,
): Promise<Proposal[]> {
  await gateway.markSkipped(sessionId)
  return gateway.evaluateRules(clock.today(), ProposalTrigger.Feedback)
}
