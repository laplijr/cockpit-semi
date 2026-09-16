import { DEFAULT_CONSTRAINTS } from '../domain/athlete/constraints'
import { useDatabase } from '../infra/db/client'
import { athlete } from '../infra/db/schema'

export default defineEventHandler(async () => {
  const [row] = await useDatabase().select().from(athlete).limit(1)

  return {
    id: row?.id ?? 1,
    weightKg: row?.weightKg ?? null,
    maxHr: row?.maxHr ?? null,
    constraints: row?.constraints ?? DEFAULT_CONSTRAINTS,
    onboarded: row?.onboarded ?? false,
  }
})
