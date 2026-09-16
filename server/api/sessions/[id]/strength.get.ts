import { desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { nextLoadsFor } from '../../../application/record-strength-sets'
import type { Prescription } from '../../../domain/shared/prescription'
import { useDatabase } from '../../../infra/db/client'
import { session, strengthSet } from '../../../infra/db/schema'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export interface StrengthExerciseState {
  exerciseId: string
  targetReps: number
  /** Charge tenue à la dernière séance ; nulle avant la première saisie. */
  lastLoadKg: number | null
  /** Charge proposée pour cette séance, déduite de la dernière (§ 9, P4). */
  suggestedLoadKg: number | null
}

/**
 * État des charges d'une séance de muscu : ce qui a été tenu la fois d'avant
 * et ce que le cockpit propose aujourd'hui. Les charges se lisent au moment
 * d'ouvrir le panneau, pas à la génération du plan : elles bougent à chaque
 * séance alors que le plan, lui, ne se régénère que sur déclencheur.
 */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDatabase()

  const [current] = await db
    .select({ prescription: session.prescription, date: session.date })
    .from(session)
    .where(eq(session.id, id))
    .limit(1)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })

  const steps = (current.prescription as unknown as Prescription).steps ?? []
  const targets = steps.filter((step) => step.exerciseId && step.reps !== undefined)

  const [previous] = await db
    .select({ id: session.id, prescription: session.prescription })
    .from(session)
    .innerJoin(strengthSet, eq(strengthSet.sessionId, session.id))
    .where(lt(session.date, current.date))
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

  const suggested = new Map(
    nextLoadsFor(
      previousSets.map((set) => ({
        exerciseId: set.exerciseId,
        index: set.index,
        reps: set.reps,
        loadKg: set.loadKg,
        rpe: set.rpe,
      })),
      previousTargets,
    ).map((item) => [item.exerciseId, item.loadKg]),
  )

  const lastLoads = new Map<string, number>()
  for (const set of previousSets) {
    lastLoads.set(set.exerciseId, Math.max(lastLoads.get(set.exerciseId) ?? 0, set.loadKg))
  }

  const exercises: StrengthExerciseState[] = targets.map((step) => ({
    exerciseId: step.exerciseId!,
    targetReps: step.reps!,
    lastLoadKg: lastLoads.get(step.exerciseId!) ?? null,
    suggestedLoadKg: suggested.get(step.exerciseId!) ?? lastLoads.get(step.exerciseId!) ?? null,
  }))

  return { exercises }
})
