import { desc } from 'drizzle-orm'
import { pauseDay } from '../domain/pause/pause'
import { SessionStatus } from '../domain/plan/session'
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
    .orderBy(desc(pause.startDate), desc(pause.id))
    .limit(1)

  // Seule une pause encore ouverte se présente comme telle dans le cockpit.
  const openPause = latestPause?.endDate === null ? latestPause : null

  return {
    today,
    watchZones: watchZones?.zones ?? [],
    plan: active ?? null,
    pause: openPause ? { ...openPause, day: pauseDay(openPause.startDate, today) } : null,
    /** Une séance retirée du plan n'est plus à faire : elle quitte la journée. */
    todaySessions:
      active?.sessions
        .filter((item) => item.date === today)
        .filter((item) => item.status !== SessionStatus.Cancelled) ?? [],
  }
})
