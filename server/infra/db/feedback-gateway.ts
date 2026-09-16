import { eq, isNull } from 'drizzle-orm'
import type {
  DailyLoadRow,
  FeedbackGateway,
  FeedbackInput,
} from '../../application/record-feedback'
import type { PauseGateway } from '../../application/resume-pause'
import type { IsoDate } from '../../domain/plan/calendar'
import { SessionStatus } from '../../domain/plan/session'
import type { ProposalTrigger } from '../../domain/rules/proposal-status'
import type { Database } from './client'
import { recomputeLoadFor } from './load-repository'
import { evaluateAndStore } from './proposal-repository'
import { feedback, pause, session } from './schema'

export function createFeedbackGateway(db: Database): FeedbackGateway {
  return {
    async sessionDate(sessionId: number): Promise<IsoDate | undefined> {
      const [row] = await db
        .select({ date: session.date })
        .from(session)
        .where(eq(session.id, sessionId))
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
        .where(eq(session.id, input.sessionId))
    },

    recomputeLoad(date: IsoDate): Promise<DailyLoadRow> {
      return recomputeLoadFor(db, date)
    },

    evaluateRules(today: IsoDate, trigger: ProposalTrigger) {
      return evaluateAndStore(db, today, trigger)
    },
  }
}

export function createPauseGateway(db: Database): PauseGateway {
  return {
    async closeOpenPauses(date: IsoDate): Promise<number> {
      const closed = await db
        .update(pause)
        .set({ endDate: date })
        .where(isNull(pause.endDate))
        .returning({ id: pause.id })
      return closed.length
    },
  }
}
