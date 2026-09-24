import { z } from 'zod'
import type { PhaseType } from '../../domain/plan/phases'
import {
  EstimateSource,
  LOAD_IMPLEMENTS,
  LoadImplement,
  estimatedMaxKg,
  plateBreakdown,
  workingLoadKg,
} from '../../domain/strength/estimated-max'
import { StrengthEffort, strengthExercise } from '../../domain/strength/exercises'
import {
  STRENGTH_DOSES,
  STRENGTH_PHASE_LABELS,
  upcomingStrengthPhases,
  type StrengthPhase,
} from '../../domain/strength/phases'
import { useDatabase } from '../../infra/db/client'
import { loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { strengthEstimate } from '../../infra/db/schema'
import { currentAthleteId, systemClock } from '../../utils/context'

/**
 * Le dernier palier et ce qui restait sous le pied (P26). Au-delà de trois
 * répétitions en réserve, Epley se dégrade : la feuille demande alors un
 * palier de plus, et le serveur refuse de caler sur un palier trop facile.
 */
const bodySchema = z.object({
  exerciseId: z.string().refine((id) => LOAD_IMPLEMENTS[id] !== undefined, 'Exercice non chargé.'),
  steps: z
    .array(z.object({ loadKg: z.number().min(0).max(400), reps: z.number().int().min(1).max(12) }))
    .min(1),
  reserve: z.number().int().min(0).max(3, 'Un palier de plus : trop loin de l’échec pour estimer.'),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { exerciseId, steps, reserve } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const today = systemClock.today()

  const last = steps.at(-1)!
  const maxKg = estimatedMaxKg(last.loadKg, last.reps, reserve)
  await db.insert(strengthEstimate).values({
    athleteId,
    exerciseId,
    maxKg,
    source: EstimateSource.Calibration,
    date: today,
  })

  const exercise = strengthExercise(exerciseId)!
  const implement = LOAD_IMPLEMENTS[exerciseId]!
  const intensityOf = (phase: StrengthPhase) =>
    exercise.effort === StrengthEffort.MaxStrength
      ? STRENGTH_DOSES[phase].intensity
      : exercise.defaultIntensity

  const active = await loadActivePlanVersion(db, athleteId)
  const weeks = (active?.weeks ?? []).map((week) => ({
    startDate: week.startDate,
    endDate: week.endDate,
    phaseType: week.phaseType as PhaseType,
  }))

  /** La charge du jour, puis celle de chaque phase qui vient, là où la phase se dose en pourcentage. */
  const phases = upcomingStrengthPhases(weeks, today).flatMap((span) => {
    const intensity = intensityOf(span.phase)
    const loadKg = intensity ? workingLoadKg(maxKg, intensity, implement) : null
    if (loadKg === null) return []
    return [
      {
        label: STRENGTH_PHASE_LABELS[span.phase],
        startDate: span.startDate,
        intensity: intensity!,
        loadKg,
        plates: implement === LoadImplement.Barbell ? plateBreakdown(loadKg) : null,
      },
    ]
  })

  return { exerciseId, maxKg, implement, phases }
})
