import { CYCLE_SESSION_TYPES, cyclingPrescription } from '../../domain/cycling/session-types'
import { CYCLING_MAX_LOAD_SHARE, CYCLING_PER_PHASE } from '../../domain/plan/week-support'
import { PhaseType } from '../../domain/plan/phases'
import { useDatabase } from '../../infra/db/client'
import { loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { systemClock } from '../../utils/context'

export default defineEventHandler(async () => {
  const active = await loadActivePlanVersion(useDatabase())
  const today = systemClock.today()
  const current = active?.weeks.find((week) => week.startDate <= today && today <= week.endDate)
  const phaseType = (current?.phaseType ?? PhaseType.Base) as PhaseType

  return {
    phaseType,
    ridesThisWeek: CYCLING_PER_PHASE[phaseType],
    maxLoadShare: CYCLING_MAX_LOAD_SHARE,
    ridesPerPhase: Object.values(PhaseType).map((type) => ({
      type,
      rides: CYCLING_PER_PHASE[type],
    })),
    types: Object.values(CYCLE_SESSION_TYPES).map((type) => ({
      ...type,
      prescription: cyclingPrescription(type.code),
    })),
  }
})
