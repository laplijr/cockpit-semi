import { raceTimeForVdot } from '../../domain/fitness/vdot'
import { ObjectiveMode } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { planGateway } from '../../utils/context'

export default defineEventHandler(async () => {
  const [rows, fitness] = await Promise.all([
    useDatabase().select().from(race).orderBy(race.date),
    planGateway().loadCurrentFitness(),
  ])

  return rows.map((row) => {
    const projectionS = fitness ? Math.round(raceTimeForVdot(fitness.vdot, row.distanceM)) : null
    const gapS = projectionS !== null && row.objectifS !== null ? projectionS - row.objectifS : null

    return {
      ...row,
      projectionS,
      projectionIsFloor: fitness?.isFloor ?? null,
      gapS,
      objectiveToSet: row.objectiveMode === ObjectiveMode.Time && row.objectifS === null,
    }
  })
})
