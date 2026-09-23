import type { IsoDate } from '../domain/plan/calendar'
import {
  LookupKey,
  hasUsableDate,
  registrationOpen,
  type RaceLookupFields,
} from '../domain/races/lookup'
import { ProposalTrigger } from '../domain/rules/proposal-status'
import { ProposalEffect, RuleId, type Proposal } from '../domain/rules/rules'
import { frenchShortDate } from '../domain/shared/french'

/** Au-delà, la date d'une course mérite d'être revérifiée (§ 6). */
export const RECHECK_AFTER_DAYS = 30

export interface RaceToRecheck {
  raceId: number
  name: string
  date: IsoDate
  query: string
  fields: RaceLookupFields
}

export interface RecheckGateway {
  /** Courses dont le dernier `race_lookup` a plus de 30 jours, inscriptions fermées. */
  staleLookups(today: IsoDate, olderThanDays: number): Promise<RaceToRecheck[]>
  saveLookup(raceId: number, query: string, fields: RaceLookupFields): Promise<void>
  storeProposals(proposals: Proposal[], trigger: ProposalTrigger): Promise<Proposal[]>
}

export interface Searcher {
  search(query: string): Promise<RaceLookupFields>
}

/**
 * Revérifie la date des courses dont la recherche date. Une date qui change
 * produit une proposition : jamais d'écriture silencieuse sur le calendrier.
 */
export async function recheckRaces(
  gateway: RecheckGateway,
  searcher: Searcher,
  today: IsoDate,
): Promise<Proposal[]> {
  const stale = await gateway.staleLookups(today, RECHECK_AFTER_DAYS)
  const proposals: Proposal[] = []

  for (const race of stale) {
    if (registrationOpen(race.fields)) continue

    const fields = await searcher.search(race.query)
    await gateway.saveLookup(race.raceId, race.query, fields)

    const found = fields[LookupKey.Date]?.value
    if (!found || !hasUsableDate(fields) || found === race.date) continue

    proposals.push({
      ruleId: RuleId.C1,
      effect: ProposalEffect.MoveRace,
      target: { kind: 'race', id: race.raceId },
      before: `${race.name} le ${frenchShortDate(race.date)}`,
      after: `${race.name} le ${frenchShortDate(found)}`,
      explanation: `La date annoncée par l'organisateur a changé depuis la dernière vérification.`,
      payload: { date: found },
    })
  }

  return gateway.storeProposals(proposals, ProposalTrigger.RaceLookup)
}
