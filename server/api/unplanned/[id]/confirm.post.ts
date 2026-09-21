import { z } from 'zod'
import { confirmUnplanned } from '../../../application/record-unplanned'
import { Sport } from '../../../domain/shared/sport'
import {
  IntensityProfile,
  UnavailabilityScope,
  UnplannedKind,
} from '../../../domain/unplanned/events'
import { useDatabase } from '../../../infra/db/client'
import { createUnplannedGateway } from '../../../infra/db/unplanned-gateway'
import { currentAthleteId, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** L'athlète peut corriger l'interprétation avant de confirmer : on la revalide. */
const bodySchema = z.object({
  events: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal(UnplannedKind.Activity),
          sport: z.enum(Sport),
          date: isoDate,
          durationMin: z.number().positive(),
          rpeEstimate: z.number().int().min(1).max(10),
          intensityProfile: z.enum(IntensityProfile),
          label: z.string().min(1),
        }),
        z.object({
          kind: z.literal(UnplannedKind.Unavailability),
          from: isoDate,
          to: isoDate,
          scope: z.enum(UnavailabilityScope),
          label: z.string().min(1),
        }),
      ]),
    )
    .optional(),
})

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { events } = await readValidatedBody(event, bodySchema.parse)

  try {
    const result = await confirmUnplanned(
      createUnplannedGateway(useDatabase(), athleteId),
      systemClock,
      id,
      events,
    )
    return { ok: true, activities: result.activities, proposals: result.proposals.length }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Imprévu inconnu' })
  }
})
