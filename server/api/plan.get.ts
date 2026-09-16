import { desc } from 'drizzle-orm'
import { pauseDay } from '../domain/pause/pause'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { pause } from '../infra/db/schema'
import { planGateway, systemClock } from '../utils/context'

export default defineEventHandler(async () => {
  const [active, latestPause] = await Promise.all([
    loadActivePlanVersion(useDatabase()),
    planGateway().loadLatestPause(),
  ])
  const today = systemClock.today()

  const [watchZones] = await useDatabase()
    .select({ zones: pause.watchZones })
    .from(pause)
    .orderBy(desc(pause.startDate))
    .limit(1)

  // Seule une pause encore ouverte se présente comme telle dans le cockpit.
  const openPause = latestPause?.endDate === null ? latestPause : null

  return {
    today,
    watchZones: watchZones?.zones ?? [],
    plan: active ?? null,
    pause: openPause ? { ...openPause, day: pauseDay(openPause.startDate, today) } : null,
    todaySessions: active?.sessions.filter((item) => item.date === today) ?? [],
  }
})
