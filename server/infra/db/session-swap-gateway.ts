import { and, eq, inArray } from 'drizzle-orm'
import type { SessionSwapGateway, StoredSession } from '../../application/replace-ride-with-run'
import { SessionStatus } from '../../domain/plan/session'
import type { Prescription } from '../../domain/shared/prescription'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import { athleteWeekIds } from './plan-gateway'
import { session, week } from './schema'

type SessionRow = typeof session.$inferSelect

function toSwappable(row: SessionRow): StoredSession {
  return {
    id: row.id,
    weekId: row.weekId,
    date: row.date,
    sport: row.sport as Sport,
    code: row.code,
    status: row.status as SessionStatus,
    key: row.key,
    prescription: row.prescription as unknown as Prescription,
  }
}

export function createSessionSwapGateway(db: Database, athleteId: number): SessionSwapGateway {
  const mine = () => athleteWeekIds(db, athleteId)

  async function setPrescription(sessionId: number, prescription: Prescription, sport?: Sport) {
    await db
      .update(session)
      .set({
        prescription: prescription as unknown as Record<string, unknown>,
        status: SessionStatus.Modified,
        ...(sport ? { sport, code: prescription.code } : {}),
      })
      .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
  }

  return {
    async loadSession(sessionId) {
      const [row] = await db
        .select()
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
        .limit(1)
      return row ? toSwappable(row) : undefined
    },

    async loadWeek(weekId) {
      const [row] = await db
        .select()
        .from(week)
        .where(and(eq(week.id, weekId), inArray(week.id, mine())))
        .limit(1)
      if (!row) return undefined
      return { targetRunM: row.targetRunM, targetCyclingMin: row.targetCyclingMin }
    },

    async loadWeekSessions(weekId) {
      const rows = await db
        .select()
        .from(session)
        .where(and(eq(session.weekId, weekId), inArray(session.weekId, mine())))
      return rows.map(toSwappable)
    },

    async loadSessionsOn(date) {
      const rows = await db
        .select()
        .from(session)
        .where(and(eq(session.date, date), inArray(session.weekId, mine())))
      return rows.map(toSwappable)
    },

    async applyReplacement({ sessionId, weekId, prescription, givebacks, cyclingMinRemoved }) {
      await setPrescription(sessionId, prescription, Sport.Running)
      for (const giveback of givebacks) {
        await setPrescription(giveback.sessionId, giveback.prescription)
      }

      /** La semaine perd les minutes de vélo annulées : sa cible les perd aussi. */
      const [row] = await db
        .select()
        .from(week)
        .where(and(eq(week.id, weekId), inArray(week.id, mine())))
        .limit(1)
      if (!row) return

      await db
        .update(week)
        .set({ targetCyclingMin: Math.max(0, row.targetCyclingMin - cyclingMinRemoved) })
        .where(and(eq(week.id, weekId), inArray(week.id, mine())))
    },
  }
}
