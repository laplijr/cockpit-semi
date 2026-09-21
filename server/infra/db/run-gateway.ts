import { and, desc, eq } from 'drizzle-orm'
import type { ClosedRun, RunGateway, StoredRun } from '../../application/record-run'
import type { IsoDate } from '../../domain/plan/calendar'
import type { GeoFix } from '../../domain/tracking/fix'
import { RunStatus } from '../../domain/tracking/run'
import type { Database } from './client'
import { run } from './schema'

type RunRow = typeof run.$inferSelect

/** Lectures et écritures d'une sortie capturée dans l'app (§ 9, P10). */
export function createRunGateway(db: Database, athleteId: number): RunGateway {
  return {
    async liveRun(): Promise<StoredRun | undefined> {
      const [row] = await db
        .select()
        .from(run)
        .where(and(eq(run.athleteId, athleteId), eq(run.status, RunStatus.Live)))
        .orderBy(desc(run.startedAt))
        .limit(1)
      return row === undefined ? undefined : toStoredRun(row)
    },

    async openRun(input: {
      sessionId: number | null
      date: IsoDate
      startedAt: Date
    }): Promise<StoredRun> {
      const [row] = await db
        .insert(run)
        .values({ athleteId, ...input, status: RunStatus.Live })
        .returning()
      return toStoredRun(row!)
    },

    async loadRun(runId: number): Promise<StoredRun | undefined> {
      const [row] = await db
        .select()
        .from(run)
        .where(and(eq(run.id, runId), eq(run.athleteId, athleteId)))
        .limit(1)
      return row === undefined ? undefined : toStoredRun(row)
    },

    async saveFixes(runId: number, fixes: GeoFix[]): Promise<void> {
      await db
        .update(run)
        .set({ fixes, updatedAt: new Date() })
        .where(and(eq(run.id, runId), eq(run.athleteId, athleteId)))
    },

    async closeRun(runId: number, input: ClosedRun): Promise<void> {
      await db
        .update(run)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(run.id, runId), eq(run.athleteId, athleteId)))
    },
  }
}

function toStoredRun(row: RunRow): StoredRun {
  return {
    id: row.id,
    sessionId: row.sessionId,
    status: row.status,
    date: row.date,
    startedAt: row.startedAt,
    fixes: row.fixes,
  }
}
