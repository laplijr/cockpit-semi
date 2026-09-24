import { and, eq, inArray } from 'drizzle-orm'
import type { SessionEstimate, StrengthGateway } from '../../application/record-strength-sets'
import { EstimateSource } from '../../domain/strength/estimated-max'
import type { StrengthSetRecord } from '../../domain/strength/next-load'
import type { Prescription } from '../../domain/shared/prescription'
import type { Database } from './client'
import { athleteWeekIds } from './plan-gateway'
import { session, strengthEstimate, strengthSet } from './schema'

export function createStrengthGateway(db: Database, athleteId: number): StrengthGateway {
  const mine = () => athleteWeekIds(db, athleteId)

  /** Les séries suivent leur séance : sans elle, rien à écrire (§ 3). */
  async function owns(sessionId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: session.id })
      .from(session)
      .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
      .limit(1)
    return row !== undefined
  }

  return {
    /** Une saisie remplace l'ensemble des séries de la séance : elle fait foi. */
    async saveSets(sessionId: number, sets: StrengthSetRecord[]) {
      if (!(await owns(sessionId))) return
      await db.delete(strengthSet).where(eq(strengthSet.sessionId, sessionId))
      if (sets.length === 0) return

      await db.insert(strengthSet).values(sets.map((set) => ({ sessionId, ...set })))
    },

    /**
     * Une séance ressaisie corrige son estimation au lieu d'en ajouter une :
     * l'historique compte une estimation par séance et par exercice.
     */
    async saveSessionEstimates(sessionId: number, estimates: SessionEstimate[]) {
      const [row] = await db
        .select({ date: session.date })
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
        .limit(1)
      if (!row) return

      for (const estimate of estimates) {
        await db
          .delete(strengthEstimate)
          .where(
            and(
              eq(strengthEstimate.athleteId, athleteId),
              eq(strengthEstimate.exerciseId, estimate.exerciseId),
              eq(strengthEstimate.date, row.date),
              eq(strengthEstimate.source, EstimateSource.Session),
            ),
          )
      }
      if (estimates.length === 0) return
      await db.insert(strengthEstimate).values(
        estimates.map((estimate) => ({
          athleteId,
          exerciseId: estimate.exerciseId,
          maxKg: estimate.maxKg,
          source: EstimateSource.Session,
          date: row.date,
        })),
      )
    },

    async targetReps(sessionId: number): Promise<Record<string, number>> {
      const [row] = await db
        .select({ prescription: session.prescription })
        .from(session)
        .where(and(eq(session.id, sessionId), inArray(session.weekId, mine())))
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
