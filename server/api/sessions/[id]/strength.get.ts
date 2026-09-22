import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'
import { nextFormatsFor, nextLoadsFor } from '../../../application/record-strength-sets'
import type { Prescription } from '../../../domain/shared/prescription'
import { useDatabase } from '../../../infra/db/client'
import { athleteWeekIds } from '../../../infra/db/plan-gateway'
import { session, strengthSet } from '../../../infra/db/schema'
import { currentAthleteId } from '../../../utils/context'
import { ownedSession } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export interface StrengthExerciseState {
  exerciseId: string
  targetReps: number
  /** Charge tenue à la dernière séance ; nulle avant la première saisie. */
  lastLoadKg: number | null
  /** Charge proposée pour cette séance, déduite de la dernière (§ 9, P4). */
  suggestedLoadKg: number | null
  /** Répétitions tenues et proposées, quand l'exercice se fait sans charge (P11.3). */
  lastReps: number | null
  suggestedReps: number | null
}

/**
 * État des charges d'une séance de muscu : ce qui a été tenu la fois d'avant
 * et ce que le cockpit propose aujourd'hui. Les charges se lisent au moment
 * d'ouvrir le panneau, pas à la génération du plan : elles bougent à chaque
 * séance alors que le plan, lui, ne se régénère que sur déclencheur.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDatabase()

  const current = await ownedSession(db, athleteId, id)

  const steps = (current.prescription as unknown as Prescription).steps ?? []
  const targets = steps.filter((step) => step.exerciseId && step.reps !== undefined)

  const [previous] = await db
    .select({ id: session.id, prescription: session.prescription })
    .from(session)
    .innerJoin(strengthSet, eq(strengthSet.sessionId, session.id))
    .where(
      and(lt(session.date, current.date), inArray(session.weekId, athleteWeekIds(db, athleteId))),
    )
    .orderBy(desc(session.date))
    .limit(1)

  const previousSets = previous
    ? await db.select().from(strengthSet).where(eq(strengthSet.sessionId, previous.id))
    : []

  /** Le format visé est celui de la séance passée, pas celui de ses séries réalisées. */
  const previousTargets = Object.fromEntries(
    ((previous?.prescription as unknown as Prescription)?.steps ?? [])
      .filter((step) => step.exerciseId && step.reps !== undefined)
      .map((step) => [step.exerciseId!, step.reps!]),
  )

  const previousRecords = previousSets.map((set) => ({
    exerciseId: set.exerciseId,
    index: set.index,
    reps: set.reps,
    loadKg: set.loadKg,
    rpe: set.rpe,
  }))

  const suggested = new Map(
    nextLoadsFor(previousRecords, previousTargets).map((item) => [item.exerciseId, item.loadKg]),
  )

  const formats = new Map(
    nextFormatsFor(previousRecords, previousTargets).map((item) => [item.exerciseId, item.reps]),
  )

  const lastLoads = new Map<string, number>()
  const lastReps = new Map<string, number>()
  for (const set of previousSets) {
    lastLoads.set(set.exerciseId, Math.max(lastLoads.get(set.exerciseId) ?? 0, set.loadKg))
    lastReps.set(set.exerciseId, Math.max(lastReps.get(set.exerciseId) ?? 0, set.reps))
  }

  const exercises: StrengthExerciseState[] = targets.map((step) => ({
    exerciseId: step.exerciseId!,
    targetReps: step.reps!,
    lastLoadKg: lastLoads.get(step.exerciseId!) || null,
    suggestedLoadKg:
      (suggested.get(step.exerciseId!) ?? lastLoads.get(step.exerciseId!) ?? 0) || null,
    lastReps: lastReps.get(step.exerciseId!) ?? null,
    suggestedReps: formats.get(step.exerciseId!) ?? null,
  }))

  return { exercises }
})
