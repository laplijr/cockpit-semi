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
import { STRENGTH_SESSION_TYPES, strengthPrescription } from '../../domain/strength/session-types'
import { STRENGTH_PER_PHASE } from '../../domain/plan/week-support'
import { PhaseType } from '../../domain/plan/phases'
import { useDatabase } from '../../infra/db/client'
import { athleteWeekIds, loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { phase, session, strengthSet } from '../../infra/db/schema'
import { currentAthleteId, systemClock } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const [active, sets] = await Promise.all([
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
  ])

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
  for (const set of sets) {
    if (lastLoadsKg[set.exerciseId] === undefined) lastLoadsKg[set.exerciseId] = set.loadKg
  }

  return {
    phaseType,
    weekInPhase,
    strengthPhase,
    strengthPhaseLabel: STRENGTH_PHASE_LABELS[strengthPhase],
    dose: STRENGTH_DOSES[strengthPhase],
    plannedCodes: STRENGTH_PER_PHASE[phaseType],
    efforts: EFFORT_LABELS,
    recoveryByEffort: EFFORT_RECOVERY_S,
    restFactor: STRENGTH_DOSES[strengthPhase].restFactor,
    exercises: STRENGTH_EXERCISES,
    lastLoadsKg,
    sessions: Object.values(STRENGTH_SESSION_TYPES).map((type) => ({
      ...type,
      prescription: strengthPrescription(type.code, {
        phase: strengthPhase,
        progressionWeek: current?.index ?? 1,
      }),
    })),
  }
})
