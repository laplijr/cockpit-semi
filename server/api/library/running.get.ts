import { paceFor, paceRangeFor } from '../../domain/fitness/vdot'
import { RUN_SESSION_TYPES, prescription } from '../../domain/running/session-types'
import { loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { useDatabase } from '../../infra/db/client'
import { planGateway } from '../../utils/context'
import { FALLBACK_VDOT, PRUDENT_START_VOLUME_M } from '../../application/regenerate-plan'

export default defineEventHandler(async () => {
  const [fitness, active] = await Promise.all([
    planGateway().loadCurrentFitness(),
    loadActivePlanVersion(useDatabase()),
  ])

  const vdot = fitness?.vdot ?? FALLBACK_VDOT
  const weeklyVolumeM = active?.weeks[0]?.targetRunM ?? PRUDENT_START_VOLUME_M

  return {
    vdot,
    vdotIsFloor: fitness?.isFloor ?? true,
    weeklyVolumeM,
    types: Object.values(RUN_SESSION_TYPES).map((type) => ({
      ...type,
      paceSecPerKm: paceFor(vdot, type.zone),
      paceRange: paceRangeFor(vdot, type.zone),
      prescription: prescription(type.code, { vdot, weeklyVolumeM }),
    })),
  }
})
