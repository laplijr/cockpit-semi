import { and, eq, inArray, isNull } from 'drizzle-orm'
import type {
  DailyLoadRow,
  FeedbackGateway,
  FeedbackInput,
} from '../../application/record-feedback'
import type { FitnessGateway } from '../../application/record-test'
import type { PauseWriter } from '../../application/open-pause'
import type { PauseGateway } from '../../application/resume-pause'
import type { IsoDate } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import type { ProposalTrigger } from '../../domain/rules/proposal-status'
import type { Database } from './client'
import { recomputeLoadFor } from './load-repository'
import { athleteWeekIds } from './plan-gateway'
import { evaluateAndStore } from './proposal-repository'
import { feedback, fitnessPoint, pause, session } from './schema'

export function createFeedbackGateway(db: Database, athleteId: number): FeedbackGateway {
  return {
    async sessionDate(sessionId: number): Promise<IsoDate | undefined> {
      const [row] = await db
        .select({ date: session.date })
        .from(session)
        .where(
          and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))),
        )
        .limit(1)
      return row?.date
    },

    async saveFeedback(input: FeedbackInput) {
      const values = {
        rpe: input.rpe,
        sensations: input.sensations,
        sleepHours: input.sleepHours,
        pain: input.pain,
        notes: input.notes,
      }

      await db
        .insert(feedback)
        .values({ sessionId: input.sessionId, ...values })
        .onConflictDoUpdate({ target: feedback.sessionId, set: values })
    },

    async markDone(input: FeedbackInput) {
      await db
        .update(session)
        .set({
          status: SessionStatus.Done,
          actualDurationMin: input.durationMin,
          actualDistanceM: input.distanceM,
        })
        .where(
          and(
            eq(session.id, input.sessionId),
            inArray(session.weekId, athleteWeekIds(db, athleteId)),
          ),
        )
    },

    recomputeLoad(date: IsoDate): Promise<DailyLoadRow> {
      return recomputeLoadFor(db, athleteId, date)
    },

    evaluateRules(today: IsoDate, trigger: ProposalTrigger) {
      return evaluateAndStore(db, athleteId, today, trigger)
    },

    async markSkipped(sessionId: number) {
      await db
        .update(session)
        .set({ status: SessionStatus.Skipped })
        .where(
          and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))),
        )
    },
  }
}

export function createFitnessGateway(db: Database, athleteId: number): FitnessGateway {
  return {
    async saveFitnessPoint(point) {
      await db.insert(fitnessPoint).values({ ...point, athleteId })
    },
  }
}

export function createPauseGateway(db: Database, athleteId: number): PauseGateway & PauseWriter {
  return {
    async closeOpenPauses(date: IsoDate): Promise<number> {
      const closed = await db
        .update(pause)
        .set({ endDate: date })
        .where(and(eq(pause.athleteId, athleteId), isNull(pause.endDate)))
        .returning({ id: pause.id })
      return closed.length
    },

    async createPause(input): Promise<number> {
      const [row] = await db
        .insert(pause)
        .values({
          athleteId,
          type: input.type,
          zone: input.zone,
          painLevel: input.painLevel,
          startDate: input.startDate,
          estimatedEndDate: input.estimatedEndDate,
          allowances: input.allowances,
          watchZones: input.watchZones,
          notes: input.notes,
        })
        .returning({ id: pause.id })
      return row!.id
    },
  }
}
