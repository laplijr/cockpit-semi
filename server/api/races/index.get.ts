import { desc, eq } from 'drizzle-orm'
import { confidence } from '../../domain/fitness/confidence'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { project } from '../../domain/fitness/projection'
import { raceTimeForVdot } from '../../domain/fitness/vdot'
import { ObjectiveMode, RaceStatus } from '../../domain/races/race'
import { useDatabase } from '../../infra/db/client'
import { fitnessPoint, pause, race } from '../../infra/db/schema'
import { planGateway, systemClock } from '../../utils/context'

const DAYS_PER_WEEK = 7
const DAY_MS = 86_400_000

function weeksBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY_MS / DAYS_PER_WEEK)
}

/**
 * Semaines d'ici la course qu'une pause ouverte couvre : elles ne font pas
 * progresser, donc elles ne comptent pas dans le gain de bloc (§ 5).
 */
function pausedWeeksUntil(
  today: string,
  raceDate: string,
  openPause: { startDate: string; estimatedEndDate: string | null } | undefined,
): number {
  if (!openPause) return 0
  const end = openPause.estimatedEndDate
  /** Sans date de reprise, la pause couvre tout ce qui vient : aucun gain. */
  if (!end) return weeksBetween(today, raceDate)
  return weeksBetween(today, end < raceDate ? end : raceDate)
}

export default defineEventHandler(async () => {
  const db = useDatabase()
  const today = systemClock.today()

  const [rows, fitness, tests, latestPause] = await Promise.all([
    db.select().from(race).orderBy(race.date),
    planGateway().loadCurrentFitness(),
    db
      .select({ vdot: fitnessPoint.vdot })
      .from(fitnessPoint)
      .where(eq(fitnessPoint.origin, FitnessOrigin.Test))
      .orderBy(fitnessPoint.date),
    db.select().from(pause).orderBy(desc(pause.startDate)).limit(1),
  ])

  const openPause = latestPause[0]?.endDate === null ? latestPause[0] : undefined
  const testHistory = tests.map((row) => row.vdot)

  /**
   * Référence à battre en performance maximale : le meilleur chrono
   * représentatif sur la distance, à défaut l'équivalence du VDOT du jour —
   * faire mieux qu'aujourd'hui, faute de mieux à comparer (§ 5).
   */
  const referenceOn = (distanceM: number) => {
    const best = rows
      .filter(
        (row) =>
          row.status === RaceStatus.Raced &&
          row.representative &&
          row.resultatS !== null &&
          Math.abs(row.distanceM - distanceM) < 1,
      )
      .map((row) => row.resultatS!)
      .sort((a, b) => a - b)
      .at(0)

    if (best !== undefined) return best
    return fitness ? Math.round(raceTimeForVdot(fitness.vdot, distanceM)) : null
  }

  return rows.map((row) => {
    if (!fitness) {
      return {
        ...row,
        projectionS: null,
        projectionLowS: null,
        projectionHighS: null,
        projectionIsFloor: null,
        gapS: null,
        confidencePct: null,
        objectiveToSet: row.objectiveMode === ObjectiveMode.Time && row.objectifS === null,
      }
    }

    const projection = project({
      vdot: fitness.vdot,
      isFloor: fitness.isFloor,
      testHistory,
      weeksToRace: weeksBetween(today, row.date),
      pausedWeeks: pausedWeeksUntil(today, row.date, openPause),
      distanceM: row.distanceM,
      elevationGainM: row.elevationGainM,
      expectedTempC: row.expectedTempC,
    })

    const targetS =
      row.objectiveMode === ObjectiveMode.MaxPerformance
        ? referenceOn(row.distanceM)
        : row.objectifS

    return {
      ...row,
      projectionS: projection.timeS,
      projectionLowS: projection.lowS,
      projectionHighS: projection.highS,
      projectionIsFloor: fitness.isFloor,
      gapS: row.objectifS === null ? null : projection.timeS - row.objectifS,
      confidencePct: confidence(projection, { targetS }),
      objectiveToSet: row.objectiveMode === ObjectiveMode.Time && row.objectifS === null,
    }
  })
})
