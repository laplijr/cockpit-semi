import { eq } from 'drizzle-orm'
import { confidence } from '../../domain/fitness/confidence'
import { objectiveIsUnset, projectionVerdict, proposeLevels } from '../../domain/fitness/objective'
import { ObjectiveMode, RaceStatus } from '../../domain/races/race'
import { canRecordResult } from '../../domain/races/result'
import { useDatabase } from '../../infra/db/client'
import { race } from '../../infra/db/schema'
import { loadProjectionContext, projectRace } from '../../utils/race-projection'
import { currentAthleteId, systemClock } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const today = systemClock.today()

  const [rows, context] = await Promise.all([
    db.select().from(race).where(eq(race.athleteId, athleteId)).orderBy(race.date),
    loadProjectionContext(db, athleteId),
  ])

  /**
   * Record sur la distance : le meilleur résultat représentatif, **sans repli**.
   * Sans record, le mode n'est pas proposé — « battre mon record » quand il n'y
   * en a pas ne veut rien dire (§ 5).
   */
  const recordOn = (distanceM: number) =>
    rows
      .filter(
        (row) =>
          row.status === RaceStatus.Raced &&
          row.representative &&
          row.resultatS !== null &&
          Math.abs(row.distanceM - distanceM) < 1,
      )
      .sort((a, b) => a.resultatS! - b.resultatS!)
      .at(0)

  return rows.map((row) => {
    const levels = {
      ambitionS: row.objectifAmbitionS,
      realisticS: row.objectifS,
      floorS: row.objectifPlancherS,
    }
    const record = row.objectiveMode === ObjectiveMode.Record ? recordOn(row.distanceM) : undefined

    const base = {
      ...row,
      recordS: record?.resultatS ?? null,
      recordDate: record?.date ?? null,
      recordName: record?.name ?? null,
      objectiveToSet: row.objectiveMode === ObjectiveMode.Time && objectiveIsUnset(levels),
      /** La course a eu lieu et attend son chrono : l'écran n'a pas à redire la règle (§ 5). */
      awaitingResult: canRecordResult(row, today),
    }

    const projection = projectRace(context, row)
    if (!projection) {
      return {
        ...base,
        projectionS: null,
        projectionLowS: null,
        projectionHighS: null,
        projectionIsFloor: null,
        proposedLevels: null,
        gapS: null,
        verdict: null,
        confidencePct: null,
        confidenceAmbitionPct: null,
        confidencePlancherPct: null,
      }
    }

    // Les trois confiances sont trois appels de la même primitive, pas une
    // seconde loi : en mode record, la cible est le record (§ 9, P5.15).
    const confidenceFor = (targetS: number | null) => confidence(projection, { targetS })
    const realisticTargetS = record ? record.resultatS : row.objectifS
    const gapS = realisticTargetS === null ? null : projection.timeS - realisticTargetS

    return {
      ...base,
      projectionS: projection.timeS,
      projectionLowS: projection.lowS,
      projectionHighS: projection.highS,
      projectionIsFloor: context.fitness!.isFloor,
      proposedLevels: proposeLevels(projection),
      gapS,
      verdict: gapS === null ? null : projectionVerdict(gapS, record ? 'record' : 'objectif'),
      confidencePct: confidenceFor(realisticTargetS),
      confidenceAmbitionPct: confidenceFor(row.objectifAmbitionS),
      confidencePlancherPct: confidenceFor(row.objectifPlancherS),
    }
  })
})
