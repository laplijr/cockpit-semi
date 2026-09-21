import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { EditContext, PlanEditGateway } from '../../application/edit-plan-session'
import { STANDARD_INCREASE_PCT, defaultsFor } from '../../domain/athlete/profile'
import { SessionOrigin, SessionStatus } from '../../domain/plan/session'
import type { PlannedSessionRecord } from '../../domain/plan/session'
import type { RacePriority } from '../../domain/races/race'
import { RaceStatus } from '../../domain/races/race'
import type { Prescription } from '../../domain/shared/prescription'
import type { Sport } from '../../domain/shared/sport'
import { FALLBACK_VDOT } from '../../application/regenerate-plan'
import type { Database } from './client'
import { athleteWeekIds, loadActivePlanVersion } from './plan-gateway'
import { athlete, fitnessPoint, pause, race, session } from './schema'

type SessionRow = typeof session.$inferSelect

function toRecord(row: SessionRow): PlannedSessionRecord {
  return {
    id: row.id,
    date: row.date,
    sport: row.sport as Sport,
    code: row.code,
    status: row.status as SessionStatus,
    key: row.key,
    prescription: row.prescription as unknown as Prescription,
  }
}

export function createPlanEditGateway(db: Database, athleteId: number): PlanEditGateway {
  const mine = () => athleteWeekIds(db, athleteId)

  /** Marque la journée : c'est elle qui la gèle à la régénération (§ 5, P6.43). */
  async function markManual(sessionId: number, extra: Record<string, unknown>) {
    await db
      .update(session)
      .set({ origin: SessionOrigin.Manual, ...extra })
      .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
  }

  return {
    async loadContext(date): Promise<EditContext | undefined> {
      const active = await loadActivePlanVersion(db, athleteId)
      const target = active?.weeks.find((item) => item.startDate <= date && date <= item.endDate)
      if (!active || !target) return undefined

      const previous = active.weeks.find((item) => item.index === target.index - 1)

      const [profile] = await db.select().from(athlete).where(eq(athlete.id, athleteId)).limit(1)
      const [fitness] = await db
        .select()
        .from(fitnessPoint)
        .where(eq(fitnessPoint.athleteId, athleteId))
        .orderBy(desc(fitnessPoint.date), desc(fitnessPoint.id))
        .limit(1)
      const [latestPause] = await db
        .select()
        .from(pause)
        .where(eq(pause.athleteId, athleteId))
        .orderBy(desc(pause.startDate), desc(pause.id))
        .limit(1)
      const races = await db
        .select({ date: race.date, priority: race.priority })
        .from(race)
        .where(and(eq(race.athleteId, athleteId), eq(race.status, RaceStatus.Planned)))
        .orderBy(asc(race.date))

      return {
        week: {
          id: target.id,
          startDate: target.startDate,
          endDate: target.endDate,
          targetRunM: target.targetRunM,
        },
        previousWeekRunM: previous?.targetRunM ?? null,
        sessions: active.sessions
          .filter((item) => item.weekId === target.id)
          .filter((item) => item.status !== SessionStatus.Cancelled)
          .map(toRecord),
        vdot: fitness?.vdot ?? FALLBACK_VDOT,
        maxWeeklyIncreasePct: profile?.profile
          ? defaultsFor(profile.profile).maxWeeklyIncreasePct
          : STANDARD_INCREASE_PCT,
        races: races.map((item) => ({ date: item.date, priority: item.priority as RacePriority })),
        allowances: latestPause?.endDate === null ? latestPause.allowances : undefined,
      }
    },

    async loadSession(sessionId) {
      const [row] = await db
        .select()
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
        .limit(1)
      return row ? { ...toRecord(row), weekId: row.weekId } : undefined
    },

    async writeSession({ sessionId, sport, prescription, key }) {
      await markManual(sessionId, {
        sport,
        code: prescription.code,
        prescription: prescription as unknown as Record<string, unknown>,
        status: SessionStatus.Modified,
        key,
      })
    },

    async cancelSession(sessionId) {
      await markManual(sessionId, { status: SessionStatus.Cancelled })
    },

    async createSession({ weekId, date, sport, prescription, key }) {
      const [row] = await db
        .insert(session)
        .values({
          weekId,
          date,
          sport,
          code: prescription.code,
          prescription: prescription as unknown as Record<string, unknown>,
          status: SessionStatus.Modified,
          origin: SessionOrigin.Manual,
          key,
        })
        .returning({ id: session.id })
      return row!.id
    },

    /**
     * Rendre la journée au moteur : les séances posées à la main disparaissent,
     * celles qu'il avait produites retrouvent leur état de départ.
     */
    async clearDay(date) {
      const rows = await db
        .select()
        .from(session)
        .where(
          and(
            eq(session.date, date),
            eq(session.origin, SessionOrigin.Manual),
            inArray(session.weekId, mine()),
          ),
        )

      for (const row of rows) {
        if (row.status === SessionStatus.Cancelled) {
          await db
            .update(session)
            .set({ status: SessionStatus.Planned, origin: SessionOrigin.Plan })
            .where(and(eq(session.id, row.id), inArray(session.weekId, mine())))
          continue
        }
        await db.delete(session).where(and(eq(session.id, row.id), inArray(session.weekId, mine())))
      }

      return rows.length
    },
  }
}
