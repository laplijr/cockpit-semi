import type { Clock } from '../application/ports'
import { useDatabase } from '../infra/db/client'
import { createPlanGateway } from '../infra/db/plan-gateway'

export const systemClock: Clock = {
  today: () => new Date().toISOString().slice(0, 10),
}

export function planGateway() {
  return createPlanGateway(useDatabase())
}
