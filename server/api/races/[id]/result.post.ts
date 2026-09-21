import { z } from 'zod'
import { recordRaceResult } from '../../../application/record-race-result'
import { SegmentMode } from '../../../domain/races/race'
import { resultRefusal } from '../../../domain/races/result'
import { useDatabase } from '../../../infra/db/client'
import { createRaceResultGateway } from '../../../infra/db/race-result-gateway'
import { currentAthleteId, planGateway, systemClock } from '../../../utils/context'
import { ownedRace } from '../../../utils/scope'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const segmentSchema = z
  .object({
    kmDebut: z.number().min(0),
    kmFin: z.number().positive(),
    mode: z.enum(SegmentMode),
    allureSKm: z.number().positive().nullable().default(null),
    note: z.string().nullable().default(null),
  })
  .refine((segment) => segment.kmFin > segment.kmDebut, {
    message: 'Un segment finit après son début.',
  })

const bodySchema = z.object({
  resultatS: z.number().int().positive(),
  /** Faux quand le chrono ne reflète pas la forme : il ne calibre alors pas le VDOT. */
  representative: z.boolean().default(true),
  incident: z
    .object({ km: z.number().min(0), type: z.string().min(1), note: z.string() })
    .nullable()
    .default(null),
  segments: z.array(segmentSchema).default([]),
  notes: z.string().nullable().default(null),
})

/**
 * Enregistre le résultat d'une course courue. La règle de date est vérifiée
 * ici, sur l'horloge de l'app : un bouton absent de l'écran n'est pas une
 * garantie (§ 5, § 9 P6.41).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()

  const existing = await ownedRace(db, athleteId, id)

  const refusal = resultRefusal(existing, systemClock.today(), body.resultatS)
  if (refusal) throw createError({ statusCode: 409, statusMessage: refusal })

  return recordRaceResult(
    createRaceResultGateway(db, athleteId),
    planGateway(athleteId),
    systemClock,
    existing,
    {
      raceId: id,
      ...body,
    },
  )
})
