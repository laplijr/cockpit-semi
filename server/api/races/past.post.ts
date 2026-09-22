import { z } from 'zod'
import { recordRaceResult } from '../../application/record-race-result'
import { ObjectiveMode, RacePriority, RaceSource, RaceStatus } from '../../domain/races/race'
import { resultRefusal } from '../../domain/races/result'
import { useDatabase } from '../../infra/db/client'
import { createRaceResultGateway } from '../../infra/db/race-result-gateway'
import { race } from '../../infra/db/schema'
import { currentAthleteId, planGateway, systemClock } from '../../utils/context'

const bodySchema = z.object({
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.number().positive(),
  elevationGainM: z.number().int().nullable().default(null),
  resultatS: z.number().int().positive(),
  /** Faux quand le chrono ne reflète pas la forme : il ne calibre alors pas le VDOT. */
  representative: z.boolean().default(true),
})

/**
 * Une course déjà courue : elle naît `courue` et ne traverse jamais l'état
 * « planifiée dans le passé », d'où viennent les effets de bord. Aucun chemin
 * d'écriture nouveau — la course posée, `recordRaceResult` porte le résultat,
 * le point de forme et la régénération, comme depuis P6.41 (§ 9, P7.5).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  /** La règle de date et la plausibilité du chrono sont celles de P6.41. */
  const refusal = resultRefusal(
    { status: RaceStatus.Planned, date: body.date, distanceM: body.distanceM },
    systemClock.today(),
    body.resultatS,
  )
  if (refusal) throw createError({ statusCode: 409, statusMessage: refusal })

  const [created] = await db
    .insert(race)
    .values({
      athleteId,
      name: body.name,
      date: body.date,
      distanceM: body.distanceM,
      elevationGainM: body.elevationGainM,
      /** Une course passée ne structure rien : sa priorité n'est pas une question. */
      priority: RacePriority.C,
      objectiveMode: ObjectiveMode.Time,
      source: RaceSource.Manual,
      status: RaceStatus.Raced,
    })
    .returning()

  return recordRaceResult(
    createRaceResultGateway(db, athleteId),
    planGateway(athleteId),
    systemClock,
    created!,
    {
      raceId: created!.id,
      resultatS: body.resultatS,
      representative: body.representative,
      incident: null,
      segments: [],
      notes: null,
    },
  )
})
