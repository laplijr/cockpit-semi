import { desc } from 'drizzle-orm'
import { pauseDay } from '../domain/pause/pause'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { pause } from '../infra/db/schema'
import { planGateway, systemClock } from '../utils/context'

export default defineEventHandler(async () => {
  const [active, openPause] = await Promise.all([
    loadActivePlanVersion(useDatabase()),
    planGateway().loadOpenPause(),
  ])
  const today = systemClock.today()
  const [latestPause] = await useDatabase()
    .select({ watchZones: pause.watchZones })
    .from(pause)
    .orderBy(desc(pause.startDate))
    .limit(1)

  return {
    today,
    watchZones: latestPause?.watchZones ?? [],
    plan: active ?? null,
    pause: openPause ? { ...openPause, day: pauseDay(openPause.startDate, today) } : null,
    todaySessions: active?.sessions.filter((item) => item.date === today) ?? [],
  }
})
