import { desc, eq } from 'drizzle-orm'
import { useDatabase } from '../../infra/db/client'
import { activity } from '../../infra/db/schema'
import { currentAthleteId } from '../../utils/context'

/** Borne d'import : jusqu'où le cockpit connaît déjà les activités. */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const [row] = await useDatabase()
    .select({ date: activity.date, externalId: activity.externalId })
    .from(activity)
    .where(eq(activity.athleteId, athleteId))
    .orderBy(desc(activity.date), desc(activity.id))
    .limit(1)

  return { lastImportedDate: row?.date ?? null, lastExternalId: row?.externalId ?? null }
})
