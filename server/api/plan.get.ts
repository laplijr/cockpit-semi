import { pauseDay } from '../domain/pause/pause'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { planGateway, systemClock } from '../utils/context'

export default defineEventHandler(async () => {
  const [active, openPause] = await Promise.all([
    loadActivePlanVersion(useDatabase()),
    planGateway().loadOpenPause(),
  ])
  const today = systemClock.today()

  return {
    today,
    plan: active ?? null,
    pause: openPause ? { ...openPause, day: pauseDay(openPause.startDate, today) } : null,
    todaySessions: active?.sessions.filter((item) => item.date === today) ?? [],
  }
})
