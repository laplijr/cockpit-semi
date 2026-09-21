import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import type { ActivityImportGateway, ActivityRow } from '../../application/import-activities'
import type { CandidateSession } from '../../domain/matching/match-activity'
import type { IsoDate } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import type { Database } from './client'
import { recomputeLoadFor } from './load-repository'
import { athleteWeekIds } from './plan-gateway'
import { activity, athlete, session } from './schema'

/** Lectures et écritures de l'import d'activités depuis la montre (§ 9, P6.7). */
export function createActivityImportGateway(
  db: Database,
  athleteId: number,
): ActivityImportGateway {
  return {
    async knownExternalIds(ids: string[]): Promise<string[]> {
      if (ids.length === 0) return []
      const rows = await db
        .select({ externalId: activity.externalId })
        .from(activity)
        .where(and(eq(activity.athleteId, athleteId), inArray(activity.externalId, ids)))
      return rows.map((row) => row.externalId)
    },

    async maxHeartRate(): Promise<number | null> {
      const [row] = await db
        .select({ maxHr: athlete.maxHr })
        .from(athlete)
        .where(eq(athlete.id, athleteId))
        .limit(1)
      return row?.maxHr ?? null
    },

    async candidateSessions(from: IsoDate, to: IsoDate): Promise<CandidateSession[]> {
      const rows = await db
        .select()
        .from(session)
        .where(
          and(
            gte(session.date, from),
            lte(session.date, to),
            inArray(session.weekId, athleteWeekIds(db, athleteId)),
          ),
        )

      return rows.map((row) => ({
        id: row.id,
        date: row.date,
        sport: row.sport,
        alreadyMatched: row.status === SessionStatus.Done,
      }))
    },

    async saveActivity(row: ActivityRow): Promise<void> {
      await db.insert(activity).values({
        athleteId,
        externalId: row.externalId,
        name: null,
        sport: row.sport,
        date: row.date,
        startedAt: row.startedAt,
        durationS: row.durationS,
        distanceM: row.distanceM,
        averagePaceSKm:
          row.distanceM && row.distanceM > 0 ? (row.durationS / row.distanceM) * 1000 : null,
        averageHr: row.averageHr,
        maxHr: row.maxHr,
        averageWatts: null,
        elevationGainM: row.elevationGainM,
        rpe: row.rpe,
        sessionId: row.sessionId,
      })
    },

    async sessionCode(sessionId: number): Promise<string | undefined> {
      const [row] = await db
        .select({ code: session.code })
        .from(session)
        .where(
          and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))),
        )
        .limit(1)
      return row?.code
    },

    async recomputeLoad(date: IsoDate): Promise<void> {
      await recomputeLoadFor(db, athleteId, date)
    },
  }
}
