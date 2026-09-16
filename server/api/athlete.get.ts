import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../domain/athlete/constraints'
import { useDatabase } from '../infra/db/client'
import { athlete } from '../infra/db/schema'

export default defineEventHandler(async () => {
  const [row] = await useDatabase().select().from(athlete).limit(1)

  return {
    id: row?.id ?? 1,
    weightKg: row?.weightKg ?? null,
    maxHr: row?.maxHr ?? null,
    startWeeklyVolumeM: row?.startWeeklyVolumeM ?? DEFAULT_START_VOLUME_M,
    peakWeeklyVolumeM: row?.peakWeeklyVolumeM ?? DEFAULT_PEAK_VOLUME_M,
    constraints: row?.constraints ?? DEFAULT_CONSTRAINTS,
    onboarded: row?.onboarded ?? false,
  }
})
