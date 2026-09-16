import { eq } from 'drizzle-orm'
import type { StrengthGateway } from '../../application/record-strength-sets'
import type { StrengthSetRecord } from '../../domain/strength/next-load'
import type { Prescription } from '../../domain/shared/prescription'
import type { Database } from './client'
import { session, strengthSet } from './schema'

export function createStrengthGateway(db: Database): StrengthGateway {
  return {
    /** Une saisie remplace l'ensemble des séries de la séance : elle fait foi. */
    async saveSets(sessionId: number, sets: StrengthSetRecord[]) {
      await db.delete(strengthSet).where(eq(strengthSet.sessionId, sessionId))
      if (sets.length === 0) return

      await db.insert(strengthSet).values(sets.map((set) => ({ sessionId, ...set })))
    },

    async targetReps(sessionId: number): Promise<Record<string, number>> {
      const [row] = await db
        .select({ prescription: session.prescription })
        .from(session)
        .where(eq(session.id, sessionId))
        .limit(1)
      if (!row) return {}

      const steps = (row.prescription as unknown as Prescription).steps ?? []
      const targets: Record<string, number> = {}
      for (const step of steps) {
        if (step.exerciseId && step.reps !== undefined) targets[step.exerciseId] = step.reps
      }
      return targets
    },
  }
}
