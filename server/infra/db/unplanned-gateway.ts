import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { UnplannedGateway } from '../../application/record-unplanned'
import type { IsoDate } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import { ProposalStatus, type ProposalTrigger } from '../../domain/rules/proposal-status'
import type { Proposal, UpcomingSession } from '../../domain/rules/rules'
import type { Prescription } from '../../domain/shared/prescription'
import type { RunSessionCode } from '../../domain/running/session-types'
import { UnplannedStatus, type UnplannedActivity } from '../../domain/unplanned/events'
import type { Database } from './client'
import { recomputeLoadFor } from './load-repository'
import { activity, proposal, session, unplannedEvent } from './schema'

/** Un imprévu n'a pas d'identifiant externe : on en fabrique un, stable et lisible. */
function externalIdFor(item: UnplannedActivity): string {
  return `imprevu:${item.date}:${item.sport}:${item.label}`
}

export function createUnplannedGateway(db: Database): UnplannedGateway {
  return {
    async plannedSessions(from: IsoDate, to: IsoDate) {
      const rows = await db
        .select({
          date: session.date,
          sport: session.sport,
          prescription: session.prescription,
        })
        .from(session)
        .where(and(gte(session.date, from), lte(session.date, to)))
        .orderBy(asc(session.date))

      return rows.map((row) => ({
        date: row.date,
        sport: row.sport,
        label: (row.prescription as unknown as Prescription).label,
      }))
    },

    async upcoming(from: IsoDate, to: IsoDate): Promise<UpcomingSession[]> {
      const rows = await db
        .select()
        .from(session)
        .where(
          and(
            gte(session.date, from),
            lte(session.date, to),
            eq(session.status, SessionStatus.Planned),
          ),
        )
        .orderBy(asc(session.date))

      return rows.map((row) => {
        const prescription = row.prescription as unknown as Prescription
        return {
          sessionId: row.id,
          date: row.date,
          sport: row.sport,
          code: row.code as RunSessionCode,
          key: row.key,
          distanceM: prescription.totalDistanceM,
          repeats: prescription.steps.find((step) => step.intense && step.repeats)?.repeats ?? null,
        }
      })
    },

    async saveDraft(rawText, events) {
      const [row] = await db
        .insert(unplannedEvent)
        .values({ rawText, events })
        .returning({ id: unplannedEvent.id })
      return row!.id
    },

    async loadDraft(id) {
      const [row] = await db.select().from(unplannedEvent).where(eq(unplannedEvent.id, id)).limit(1)
      return row ? { id: row.id, events: row.events } : undefined
    },

    async markConfirmed(id, at) {
      await db
        .update(unplannedEvent)
        .set({ status: UnplannedStatus.Confirmed, confirmedAt: at })
        .where(eq(unplannedEvent.id, id))
    },

    async recordActivity(item, rpe) {
      const values = {
        externalId: externalIdFor(item),
        name: item.label,
        sport: item.sport,
        date: item.date,
        startedAt: new Date(`${item.date}T12:00:00Z`),
        durationS: Math.round(item.durationMin * 60),
        /** L'activité porte le RPE retenu ; c'est lui qui donne sa charge (§ 5). */
        rpe,
      }

      await db
        .insert(activity)
        .values(values)
        .onConflictDoUpdate({ target: activity.externalId, set: values })
    },

    async recomputeLoad(date) {
      await recomputeLoadFor(db, date)
    },

    async storeProposals(proposals: Proposal[], trigger: ProposalTrigger) {
      if (proposals.length === 0) return []

      await db.insert(proposal).values(
        proposals.map((item) => ({
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
