import { measureTrack } from '../../domain/tracking/track'
import { currentAthleteId, runGateway } from '../../utils/context'

/**
 * La sortie en cours, s'il y en a une. C'est ce que la ligne du jour lit pour
 * proposer « Reprendre la sortie » au lieu de « Courir » (§ 9, P10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const run = await runGateway(athleteId).liveRun()
  if (!run) return { run: null }

  const track = measureTrack(run.fixes)

  return {
    run: {
      id: run.id,
      sessionId: run.sessionId,
      date: run.date,
      startedAt: run.startedAt,
      distanceM: track.distanceM,
      elapsedS: track.elapsedS,
    },
  }
})
