import { and, desc, eq, isNotNull, lt } from 'drizzle-orm'
import type { RaceToRecheck, RecheckGateway } from '../../application/recheck-races'
import type { IsoDate } from '../../domain/plan/calendar'
import type { RaceLookupFields } from '../../domain/races/lookup'
import { RaceStatus } from '../../domain/races/race'
import { ProposalStatus, type ProposalTrigger } from '../../domain/rules/proposal-status'
import type { Proposal } from '../../domain/rules/rules'
import type { Database } from './client'
import { proposal, race, raceLookup } from './schema'

export function createRecheckGateway(db: Database, athleteId: number): RecheckGateway {
  return {
    async staleLookups(today: IsoDate, olderThanDays: number): Promise<RaceToRecheck[]> {
      const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - olderThanDays * 86_400_000)

      const rows = await db
        .select({
          raceId: race.id,
          name: race.name,
          date: race.date,
          query: raceLookup.query,
          fields: raceLookup.fields,
          checkedAt: raceLookup.checkedAt,
        })
        .from(raceLookup)
        .innerJoin(race, eq(raceLookup.raceId, race.id))
        .where(
          and(
            eq(raceLookup.athleteId, athleteId),
            isNotNull(raceLookup.raceId),
            lt(raceLookup.checkedAt, cutoff),
            eq(race.status, RaceStatus.Planned),
          ),
        )
        .orderBy(desc(raceLookup.checkedAt))

      /** Une course peut avoir plusieurs recherches : seule la dernière compte. */
      const latest = new Map<number, RaceToRecheck>()
      for (const row of rows) {
        if (latest.has(row.raceId)) continue
        latest.set(row.raceId, {
          raceId: row.raceId,
          name: row.name,
          date: row.date,
          query: row.query,
          fields: row.fields,
        })
      }

      return [...latest.values()]
    },

    async saveLookup(raceId: number, query: string, fields: RaceLookupFields) {
      await db.insert(raceLookup).values({ athleteId, raceId, query, fields })
    },

    async storeProposals(proposals: Proposal[], trigger: ProposalTrigger) {
      if (proposals.length === 0) return []

      await db.insert(proposal).values(
        proposals.map((item) => ({
          athleteId,
          trigger,
          ruleId: item.ruleId,
          effect: item.effect,
          targetKind: item.target.kind,
          targetId: item.target.id,
          before: item.before,
          after: item.after,
          explanation: item.explanation,
          payload: item.payload ?? null,
          status: ProposalStatus.Proposed,
        })),
      )

      return proposals
    },
  }
}
