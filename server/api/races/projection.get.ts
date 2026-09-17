import { z } from 'zod'
import { proposeLevels } from '../../domain/fitness/objective'
import { useDatabase } from '../../infra/db/client'
import { loadProjectionContext, projectRace } from '../../utils/race-projection'

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.coerce.number().positive(),
  elevationGainM: z.coerce.number().nullish(),
  expectedTempC: z.coerce.number().nullish(),
})

/**
 * Projection d'une course pas encore enregistrée, pour proposer ses trois
 * niveaux d'objectif avant la création (§ 9, P5.15).
 */
export default defineEventHandler(async (event) => {
  const target = await getValidatedQuery(event, querySchema.parse)
  const context = await loadProjectionContext(useDatabase())
  const projection = projectRace(context, target)

  if (!projection) return { projection: null, proposedLevels: null }
  return { projection, proposedLevels: proposeLevels(projection) }
})
