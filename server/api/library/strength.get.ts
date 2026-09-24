import { desc, eq, inArray } from 'drizzle-orm'
import {
  EFFORT_LABELS,
  EFFORT_RECOVERY_S,
  STRENGTH_EXERCISES,
} from '../../domain/strength/exercises'
import {
  STRENGTH_DOSES,
  STRENGTH_PHASE_LABELS,
  strengthPhaseFor,
} from '../../domain/strength/phases'
import {
  STRENGTH_CATALOGUE,
  STRENGTH_SESSION_TYPES,
  strengthPrescription,
} from '../../domain/strength/session-types'
import { strengthPerPhase } from '../../domain/plan/week-support'
import { equipmentOf, strengthIntentOf } from '../../domain/athlete/constraints'
import { EQUIPMENT_LABELS } from '../../domain/strength/equipment'
import { MUSCLE_LABELS } from '../../domain/strength/muscles'
import { STRENGTH_TECHNIQUE } from '../../domain/strength/technique'
import type { AthleteConstraints } from '../../domain/athlete/constraints'
import { PhaseType } from '../../domain/plan/phases'
import { useDatabase } from '../../infra/db/client'
import { athleteWeekIds, loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { athlete, phase, session, strengthSet } from '../../infra/db/schema'
import { currentAthleteId, systemClock } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const [active, sets, [profile]] = await Promise.all([
    loadActivePlanVersion(db, athleteId),
    db
      .select({
        exerciseId: strengthSet.exerciseId,
        loadKg: strengthSet.loadKg,
        reps: strengthSet.reps,
        date: session.date,
      })
      .from(strengthSet)
      .innerJoin(session, eq(strengthSet.sessionId, session.id))
      .where(inArray(session.weekId, athleteWeekIds(db, athleteId)))
      .orderBy(desc(session.date)),
    db.select({ constraints: athlete.constraints }).from(athlete).where(eq(athlete.id, athleteId)),
  ])

  /** Le catalogue de l'athlète, et lui seul : l'autre n'est pas le sien (§ 5, P11.2). */
  const constraints = (profile?.constraints ?? { availableDays: [] }) as AthleteConstraints
  const intent = strengthIntentOf(constraints)
  const equipment = equipmentOf(constraints)
  const perPhase = strengthPerPhase(intent)
  const catalogue = new Set(STRENGTH_CATALOGUE[intent])

  const today = systemClock.today()
  const current = active?.weeks.find((week) => week.startDate <= today && today <= week.endDate)
  const phaseType = (current?.phaseType ?? PhaseType.Base) as PhaseType

  const phases = active
    ? await db.select().from(phase).where(eq(phase.planVersionId, active.version.id))
    : []
  const currentPhase = phases.find(
    (item) => current && item.startWeek <= current.index && current.index <= item.endWeek,
  )
  const weekInPhase = current && currentPhase ? current.index - currentPhase.startWeek + 1 : 1

  const strengthPhase = strengthPhaseFor(phaseType, weekInPhase)

  /** Dernière charge tenue par exercice : la table est triée du plus récent au plus ancien. */
  const lastLoadsKg: Record<string, number> = {}
  /** Et le format tenu : au poids de corps, c'est lui qui dit ce qui a été fait (§ 5, P11.3). */
  const lastReps: Record<string, number> = {}
  for (const set of sets) {
    if (lastLoadsKg[set.exerciseId] === undefined) lastLoadsKg[set.exerciseId] = set.loadKg
    if (lastReps[set.exerciseId] === undefined) lastReps[set.exerciseId] = set.reps
  }

  return {
    phaseType,
    weekInPhase,
    strengthPhase,
    strengthPhaseLabel: STRENGTH_PHASE_LABELS[strengthPhase],
    dose: STRENGTH_DOSES[strengthPhase],
    plannedCodes: perPhase[phaseType],
    efforts: EFFORT_LABELS,
    recoveryByEffort: EFFORT_RECOVERY_S,
    restFactor: STRENGTH_DOSES[strengthPhase].restFactor,
    exercises: STRENGTH_EXERCISES,
    /** Comment faire chaque exercice : écrit une fois, relu par Ronan (P25). */
    technique: STRENGTH_TECHNIQUE,
    muscleLabels: MUSCLE_LABELS,
    lastLoadsKg,
    lastReps,
    equipment,
    equipmentLabel: EQUIPMENT_LABELS[equipment],
    sessions: Object.values(STRENGTH_SESSION_TYPES)
      .filter((type) => catalogue.has(type.code))
      .map((type) => ({
        ...type,
        prescription: strengthPrescription(type.code, {
          phase: strengthPhase,
          progressionWeek: current?.index ?? 1,
          equipment,
        }),
      })),
  }
})
