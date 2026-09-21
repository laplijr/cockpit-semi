import { z } from 'zod'
import { useDatabase } from '../../infra/db/client'
import { raceLookup } from '../../infra/db/schema'
import { createRaceSearcher } from '../../infra/search/race-lookup'
import { currentAthleteId } from '../../utils/context'

const bodySchema = z.object({ query: z.string().min(3).max(120) })

/** Recherche automatique d'une course : seul le nom tapé quitte le serveur (§ 6). */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { query } = await readValidatedBody(event, bodySchema.parse)

  const fields = await createRaceSearcher().search(query)

  const [row] = await useDatabase()
    .insert(raceLookup)
    .values({ athleteId, query, fields })
    .returning({ id: raceLookup.id })

  return { lookupId: row!.id, fields }
})
