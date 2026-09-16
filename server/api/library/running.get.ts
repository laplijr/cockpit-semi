import { TrainingZone, halfMarathonPace, paceFor, paceRangeFor } from '../../domain/fitness/vdot'
import { RUN_SESSION_TYPES, prescription } from '../../domain/running/session-types'
import { loadActivePlanVersion } from '../../infra/db/plan-gateway'
import { useDatabase } from '../../infra/db/client'
import { planGateway } from '../../utils/context'
import { DEFAULT_START_VOLUME_M } from '../../domain/athlete/constraints'
import { FALLBACK_VDOT } from '../../application/regenerate-plan'

export default defineEventHandler(async () => {
  const [fitness, active] = await Promise.all([
    planGateway().loadCurrentFitness(),
    loadActivePlanVersion(useDatabase()),
  ])

  const vdot = fitness?.vdot ?? FALLBACK_VDOT
  const weeklyVolumeM = active?.weeks[0]?.targetRunM ?? DEFAULT_START_VOLUME_M

  const zones = [
    { key: TrainingZone.Easy, label: 'Endurance' },
    { key: TrainingZone.Marathon, label: 'Marathon' },
    { key: TrainingZone.Threshold, label: 'Seuil' },
    { key: TrainingZone.Interval, label: 'Intervalle' },
    { key: TrainingZone.Repetition, label: 'Répétitions' },
  ].map((zone) => ({
    ...zone,
    paceSecPerKm: paceFor(vdot, zone.key),
    range: paceRangeFor(vdot, zone.key),
  }))

  return {
    vdot,
    zones,
    halfPaceSecPerKm: halfMarathonPace(vdot),
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
