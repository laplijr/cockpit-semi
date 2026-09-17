import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../domain/athlete/constraints'
import { ageOn, estimatedMaxHr } from '../domain/athlete/profile'
import { useDatabase } from '../infra/db/client'
import { athlete } from '../infra/db/schema'
import { systemClock } from '../utils/context'

export default defineEventHandler(async () => {
  const [row] = await useDatabase().select().from(athlete).limit(1)
  const age = row?.birthDate ? ageOn(row.birthDate, systemClock.today()) : null

  return {
    id: row?.id ?? 1,
    firstName: row?.firstName ?? null,
    birthDate: row?.birthDate ?? null,
    profile: row?.profile ?? null,
    avatar: row?.avatar ?? null,
    age,
    /** Proposée seulement quand la FC max n'est pas mesurée (§ 9, P5.7). */
    suggestedMaxHr: age === null ? null : estimatedMaxHr(age),
    weightKg: row?.weightKg ?? null,
    /** Adresse de départ des sorties : point de départ des itinéraires (§ 9, P5.5). */
    homeAddress: row?.homeAddress ?? null,
    maxHr: row?.maxHr ?? null,
    startWeeklyVolumeM: row?.startWeeklyVolumeM ?? DEFAULT_START_VOLUME_M,
    peakWeeklyVolumeM: row?.peakWeeklyVolumeM ?? DEFAULT_PEAK_VOLUME_M,
    constraints: row?.constraints ?? DEFAULT_CONSTRAINTS,
    onboarded: row?.onboarded ?? false,
  }
})
