import type { IsoDate } from '../domain/plan/calendar'
import { ProposalTrigger } from '../domain/rules/proposal-status'
import type { Proposal, UpcomingSession } from '../domain/rules/rules'
import type { Clock } from '../domain/shared/clock'
import type { Sport } from '../domain/shared/sport'
import type { UnplannedActivity, UnplannedEvent } from '../domain/unplanned/events'
import { isActivity, isUnavailability, rpeFor } from '../domain/unplanned/events'
import { proposeForUnavailabilities } from '../domain/unplanned/propose'

export interface UnplannedGateway {
  /** Séances prévues envoyées au modèle comme contexte : aucune donnée de réalisé (§ 6). */
  plannedSessions(
    from: IsoDate,
    to: IsoDate,
  ): Promise<{ date: IsoDate; sport: Sport; label: string }[]>
  /** Séances à venir que les propositions peuvent toucher. */
  upcoming(from: IsoDate, to: IsoDate): Promise<UpcomingSession[]>
  saveDraft(rawText: string, events: UnplannedEvent[]): Promise<number>
  loadDraft(id: number): Promise<{ id: number; events: UnplannedEvent[] } | undefined>
  markConfirmed(id: number, at: Date): Promise<void>
  recordActivity(activity: UnplannedActivity, rpe: number): Promise<void>
  recomputeLoad(date: IsoDate): Promise<void>
  storeProposals(proposals: Proposal[], trigger: ProposalTrigger): Promise<Proposal[]>
}

export interface Interpreter {
  interpret(
    text: string,
    context: { today: IsoDate; plannedSessions: { date: IsoDate; sport: Sport; label: string }[] },
  ): Promise<UnplannedEvent[]>
}

/** Fenêtre de séances envoyée au modèle et ouverte aux propositions. */
export const UNPLANNED_HORIZON_DAYS = 14

function shift(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
}

export interface UnplannedDraft {
  id: number
  events: UnplannedEvent[]
}

/**
 * Traduit le texte libre en événements et les met en attente de confirmation.
 * Rien n'est appliqué à ce stade : l'athlète relit d'abord l'interprétation.
 */
export async function draftUnplanned(
  gateway: UnplannedGateway,
  interpreter: Interpreter,
  clock: Clock,
  rawText: string,
): Promise<UnplannedDraft> {
  const today = clock.today()
  const plannedSessions = await gateway.plannedSessions(
    shift(today, -UNPLANNED_HORIZON_DAYS),
    shift(today, UNPLANNED_HORIZON_DAYS),
  )

  const events = await interpreter.interpret(rawText, { today, plannedSessions })
  const id = await gateway.saveDraft(rawText, events)

  return { id, events }
}

export interface ConfirmUnplannedResult {
  activities: number
  proposals: Proposal[]
}

/**
 * Confirmation : les activités entrent dans la charge, les indisponibilités
 * passent par la règle I1 et deviennent des propositions (§ 6).
 */
export async function confirmUnplanned(
  gateway: UnplannedGateway,
  clock: Clock,
  id: number,
  events?: UnplannedEvent[],
): Promise<ConfirmUnplannedResult> {
  const draft = await gateway.loadDraft(id)
  if (!draft) throw new Error(`Imprévu ${id} inconnu`)

  const confirmed = events ?? draft.events
  const activities = confirmed.filter(isActivity)
  const unavailabilities = confirmed.filter(isUnavailability)

  for (const activity of activities) {
    await gateway.recordActivity(activity, rpeFor(activity))
    await gateway.recomputeLoad(activity.date)
  }

  const today = clock.today()
  const upcoming =
    unavailabilities.length === 0
      ? []
      : await gateway.upcoming(today, shift(today, UNPLANNED_HORIZON_DAYS))

  const proposals = proposeForUnavailabilities(unavailabilities, { upcoming })
  const stored = await gateway.storeProposals(proposals, ProposalTrigger.Unplanned)

  await gateway.markConfirmed(id, new Date())

  return { activities: activities.length, proposals: stored }
}
