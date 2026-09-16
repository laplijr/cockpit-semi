import { desc } from 'drizzle-orm'
import { useDatabase } from '../../infra/db/client'
import { activity } from '../../infra/db/schema'

/** Borne d'import : jusqu'où le cockpit connaît déjà les activités. */
export default defineEventHandler(async () => {
  const [row] = await useDatabase()
    .select({ date: activity.date, externalId: activity.externalId })
    .from(activity)
    .orderBy(desc(activity.date), desc(activity.id))
    .limit(1)

  return { lastImportedDate: row?.date ?? null, lastExternalId: row?.externalId ?? null }
})
