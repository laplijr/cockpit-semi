import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'
import { nextFormatsFor, nextLoadsFor } from '../../../application/record-strength-sets'
import type { Prescription } from '../../../domain/shared/prescription'
import {
  LOAD_IMPLEMENTS,
  LoadImplement,
  estimateFromSets,
  isCalibratable,
  plateBreakdown,
  proposedLoadKg,
} from '../../../domain/strength/estimated-max'
import { targetReserve } from '../../../domain/strength/reserve'
import { useDatabase } from '../../../infra/db/client'
import { athleteWeekIds } from '../../../infra/db/plan-gateway'
import { session, strengthSet } from '../../../infra/db/schema'
import { loadCurrentEstimates } from '../../../infra/db/strength-estimates'
import { currentAthleteId } from '../../../utils/context'
import { ownedSession } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export interface StrengthExerciseState {
  exerciseId: string
  targetReps: number
  /** Charge tenue à la dernière séance de cet exercice ; nulle avant la première saisie. */
  lastLoadKg: number | null
  /** Charge proposée pour cette séance : le pourcentage du maximum estimé, sinon la progression. */
  suggestedLoadKg: number | null
  /** Répétitions tenues et proposées, quand l'exercice se fait sans charge (P11.3). */
  lastReps: number | null
  suggestedReps: number | null
  /** Répétitions à garder sous le pied à la dernière série (P25). */
  reserve: number | null
  /** Maximum estimé courant (P26). */
  estimateKg: number | null
  /** Chargé, dosé en pourcentage, sans estimation : il se cale (P26). */
  toCalibrate: boolean
  /** Disques d'un côté de la barre, pour un exercice à la barre. */
  plates: number[] | null
}

type PreviousSet = {
  sessionId: number
  prescription: unknown
  exerciseId: string
  index: number
  reps: number
  loadKg: number
  rpe: number
}

/**
 * État des charges d'une séance de muscu : ce qui a été tenu la fois d'avant
 * et ce que le cockpit propose aujourd'hui. « La fois d'avant » est la
 * dernière séance **du même exercice** : la dernière séance de muscu tout
 * court était souvent un Push, et le Legs ne connaissait alors aucune charge.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDatabase()

  const current = await ownedSession(db, athleteId, id)
  const steps = (current.prescription as unknown as Prescription).steps ?? []
  const targets = steps.filter((step) => step.exerciseId && step.reps !== undefined)
  const exerciseIds = targets.map((step) => step.exerciseId!)

  const [prior, estimates] = await Promise.all([
    exerciseIds.length === 0
      ? Promise.resolve([] as PreviousSet[])
      : db
          .select({
            sessionId: session.id,
            prescription: session.prescription,
            exerciseId: strengthSet.exerciseId,
            index: strengthSet.index,
            reps: strengthSet.reps,
            loadKg: strengthSet.loadKg,
            rpe: strengthSet.rpe,
          })
          .from(strengthSet)
          .innerJoin(session, eq(strengthSet.sessionId, session.id))
          .where(
            and(
              lt(session.date, current.date),
              inArray(strengthSet.exerciseId, exerciseIds),
              inArray(session.weekId, athleteWeekIds(db, athleteId)),
            ),
          )
          .orderBy(desc(session.date), desc(session.id)),
    loadCurrentEstimates(db, athleteId),
  ])

  const exercises: StrengthExerciseState[] = targets.map((step) => {
    const exerciseId = step.exerciseId!
    const mine = prior.filter((set) => set.exerciseId === exerciseId)
    const lastSession = mine[0]?.sessionId
    const previousSets = mine.filter((set) => set.sessionId === lastSession)
    const previousTarget = ((mine[0]?.prescription as Prescription | undefined)?.steps ?? []).find(
      (item) => item.exerciseId === exerciseId,
    )?.reps
    const targetsById = previousTarget === undefined ? {} : { [exerciseId]: previousTarget }

    const lastLoadKg = Math.max(0, ...previousSets.map((set) => set.loadKg)) || null
    const nextLoadKg =
      nextLoadsFor(previousSets, targetsById).find((item) => item.exerciseId === exerciseId)
        ?.loadKg ??
      lastLoadKg ??
      null
    /**
     * Une séance saisie avant P26 n'a pas écrit d'estimation : on la tire de
     * la dernière séance de l'exercice plutôt que de tout faire recaler.
     */
    const estimateKg =
      estimates.get(exerciseId)?.maxKg ??
      (LOAD_IMPLEMENTS[exerciseId] ? estimateFromSets(previousSets) : null)
    const suggestedLoadKg = proposedLoadKg({
      exerciseId,
      intensity: step.intensity,
      estimateKg,
      nextLoadKg,
    })

    return {
      exerciseId,
      targetReps: step.reps!,
      lastLoadKg,
      suggestedLoadKg,
      lastReps: previousSets.length > 0 ? Math.max(...previousSets.map((set) => set.reps)) : null,
      suggestedReps:
        nextFormatsFor(previousSets, targetsById).find((item) => item.exerciseId === exerciseId)
          ?.reps ?? null,
      reserve: targetReserve(step.intensity),
      estimateKg,
      toCalibrate: estimateKg === null && isCalibratable(exerciseId, step.intensity),
      plates:
        LOAD_IMPLEMENTS[exerciseId] === LoadImplement.Barbell && suggestedLoadKg !== null
          ? plateBreakdown(suggestedLoadKg)
          : null,
    }
  })

  return { exercises }
})
